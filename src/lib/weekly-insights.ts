import {
  calculateCompletionRate,
  calculateHabitStreaks,
  formatHabitFrequency,
  formatHabitTarget,
  formatProgressValue,
  getHabitDayStatus,
  getStreakUnitLabel,
  shiftIsoDate,
  type HabitCompletionRow,
  type HabitRow,
} from "./habits.ts";
import { type CategoryRow } from "./categories.ts";

export type WeeklyInsightRow = {
  id: string;
  user_id: string;
  week_start: string;
  insight_text: string;
  generated_at: string;
};

const GROQ_MODEL = "llama-3.1-8b-instant";

function formatInsightHabitType(
  habitType: HabitRow["habit_type"] | "boolean" | "quantified",
) {
  return habitType === "quantified" ? "Goal-based habit" : "Yes/No habit";
}

function formatWeekLabel(weekStartIso: string) {
  const weekStartDate = new Date(`${weekStartIso}T00:00:00`);
  const weekEndDate = new Date(`${shiftIsoDate(weekStartIso, 6)}T00:00:00`);

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(weekStartDate)} - ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
  }).format(weekEndDate)}`;
}

function getWeekDays(weekStartIso: string) {
  return Array.from({ length: 7 }, (_, index) => {
    const iso = shiftIsoDate(weekStartIso, index);
    const date = new Date(`${iso}T00:00:00`);

    return {
      iso,
      label: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
      }).format(date),
    };
  });
}

function collectCompletionMaps(completions: HabitCompletionRow[]) {
  const completionsByHabit = new Map<string, Map<string, number | null>>();

  completions.forEach((completion) => {
    const completionMap =
      completionsByHabit.get(completion.habit_id) ?? new Map<string, number | null>();

    completionMap.set(completion.completed_on, completion.value ?? null);
    completionsByHabit.set(completion.habit_id, completionMap);
  });

  return completionsByHabit;
}

export function cleanInsightText(text: string) {
  const sectionAliases = new Map([
    ["Performance Summary", "Performance"],
    ["Completion Status", "Status"],
    ["Outliers", "Exceptions"],
    ["Identified Pattern", "Observation"],
    ["Actionable Step", "Adjustment"],
    ["Performance", "Performance"],
    ["Status", "Status"],
    ["Exceptions", "Exceptions"],
    ["Observation", "Observation"],
    ["Adjustment", "Adjustment"],
  ]);

  const normalizedLines = text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[*•]\s+/, "- "))
    .map((line) => {
      const matchedLabel = Array.from(sectionAliases.keys()).find((label) =>
        line.startsWith(`${label}:`) ||
        line.startsWith(`- ${label}:`) ||
        line.startsWith(`* ${label}:`) ||
        line.startsWith(`- **${label}:**`) ||
        line.startsWith(`* **${label}:**`),
      );

      if (!matchedLabel) {
        return line;
      }

      const value = line
        .replace(/^[-*]\s+/, "")
        .replace(new RegExp(`^\\*\\*${matchedLabel}:\\*\\*\\s*`), "")
        .replace(new RegExp(`^${matchedLabel}:\\s*`), "")
        .trim();

      return `- **${sectionAliases.get(matchedLabel)}:** ${value}`;
    });

  const cleaned = normalizedLines.join("\n");
  const words = cleaned.split(/\s+/);

  if (words.length <= 170) {
    return cleaned;
  }

  return `${words.slice(0, 170).join(" ")}...`;
}

export function buildWeeklyInsightContext(input: {
  habits: HabitRow[];
  categories: CategoryRow[];
  completions: HabitCompletionRow[];
  weekStartIso: string;
}) {
  const categoriesById = new Map(input.categories.map((category) => [category.id, category]));
  const completionsByHabit = collectCompletionMaps(input.completions);
  const currentWeekDays = getWeekDays(input.weekStartIso);
  const previousWeekStartIso = shiftIsoDate(input.weekStartIso, -7);
  const previousWeekDays = getWeekDays(previousWeekStartIso);
  const currentWeekEndIso = shiftIsoDate(input.weekStartIso, 6);

  const habitBlocks = input.habits.map((habit) => {
    const habitType = habit.habit_type ?? "boolean";
    const targetValue = habit.target_value ?? null;
    const frequencyType = habit.frequency_type ?? "daily";
    const frequencyValue = habit.frequency_value ?? null;
    const frequencyDays = habit.frequency_days ?? [];
    const completionMap = completionsByHabit.get(habit.id) ?? new Map<string, number | null>();
    const category = habit.category_id
      ? categoriesById.get(habit.category_id)?.name ?? "Unknown"
      : "Uncategorized";

    const currentWeekStatuses = currentWeekDays.map((day) =>
      getHabitDayStatus({
        createdAt: habit.created_at,
        frequencyType,
        frequencyValue,
        frequencyDays,
        habitType,
        targetValue,
        iso: day.iso,
        hasCompletion: completionMap.has(day.iso),
        value: completionMap.get(day.iso) ?? null,
      }),
    );

    const previousWeekStatuses = previousWeekDays.map((day) =>
      getHabitDayStatus({
        createdAt: habit.created_at,
        frequencyType,
        frequencyValue,
        frequencyDays,
        habitType,
        targetValue,
        iso: day.iso,
        hasCompletion: completionMap.has(day.iso),
        value: completionMap.get(day.iso) ?? null,
      }),
    );

    const currentCompleted = currentWeekStatuses.filter((day) => day.completed).length;
    const currentExpected = currentWeekStatuses.filter((day) => day.expected).length;
    const previousCompleted = previousWeekStatuses.filter((day) => day.completed).length;
    const previousExpected = previousWeekStatuses.filter((day) => day.expected).length;
    const currentRate = calculateCompletionRate(currentCompleted, currentExpected);
    const previousRate = calculateCompletionRate(previousCompleted, previousExpected);
    const delta = currentRate - previousRate;
    const streakSummary = calculateHabitStreaks(
      {
        createdAt: habit.created_at,
        frequencyType,
        frequencyValue,
        frequencyDays,
      },
      Array.from(completionMap.entries())
        .filter(([, value]) =>
          habitType === "boolean"
            ? true
            : value != null && targetValue != null && value >= targetValue,
        )
        .map(([iso]) => iso)
        .filter((iso) => iso <= currentWeekEndIso),
      currentWeekEndIso,
    );

    const currentWeekDetail = currentWeekDays
      .map((day, index) => {
        const status = currentWeekStatuses[index];
        const value = completionMap.get(day.iso) ?? null;
        const valueText =
          habitType === "quantified"
            ? ` (${formatProgressValue(value)} / ${formatProgressValue(targetValue)})`
            : "";

        return `${day.label} ${day.iso}: ${
          status.completed
            ? "completed"
            : status.expected
              ? "missed"
              : "not scheduled"
        }${valueText}`;
      })
      .join("; ");

    const previousWeekDetail = previousWeekDays
      .map((day, index) => {
        const status = previousWeekStatuses[index];
        const value = completionMap.get(day.iso) ?? null;
        const valueText =
          habitType === "quantified"
            ? ` (${formatProgressValue(value)} / ${formatProgressValue(targetValue)})`
            : "";

        return `${day.label} ${day.iso}: ${
          status.completed
            ? "completed"
            : status.expected
              ? "missed"
              : "not scheduled"
        }${valueText}`;
      })
      .join("; ");

    return [
      `Habit: ${habit.name}`,
      `Category: ${category}`,
      `Type: ${formatInsightHabitType(habitType)}${habitType === "quantified" ? `, target ${formatHabitTarget(targetValue, habit.unit ?? null)}` : ""}`,
      `Frequency: ${formatHabitFrequency(frequencyType, frequencyValue, frequencyDays)}`,
      `Current streak: ${getStreakUnitLabel(frequencyType, streakSummary.current)}`,
      `Current week (${formatWeekLabel(input.weekStartIso)}): ${currentCompleted}/${currentExpected} completed, ${currentRate}%`,
      `Previous week (${formatWeekLabel(previousWeekStartIso)}): ${previousCompleted}/${previousExpected} completed, ${previousRate}%`,
      `Week-over-week delta: ${delta >= 0 ? "+" : ""}${delta} percentage points`,
      `Current week daily detail: ${currentWeekDetail}`,
      `Previous week daily detail: ${previousWeekDetail}`,
    ].join("\n");
  });

  return [
    `Current week starts on Monday ${input.weekStartIso}.`,
    `Previous week starts on Monday ${previousWeekStartIso}.`,
    `There are ${input.habits.length} active habits in this account.`,
    "",
    habitBlocks.join("\n\n"),
  ].join("\n");
}

export async function generateGroqWeeklyInsight(context: string) {
  const apiKey = process.env.GROQ_API_KEY;

  if (!apiKey) {
    throw new Error("Missing GROQ_API_KEY.");
  }

  const response = await fetch(
    "https://api.groq.com/openai/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: GROQ_MODEL,
        temperature: 0.7,
        max_completion_tokens: 220,
        messages: [
          {
            role: "system",
            content:
              "Role: You are a data-driven Habit Analyst. Terminology: use 'Yes/No habits' for simple check-offs and 'Goal-based habits' for habits with a specific count. Tone: clinical and executive. Do not use words like 'concerning', 'great', or 'disarray'. Structure: use exactly these headers and no introductory or concluding sentences. Constraint: max 12 words per bullet point. Eliminate adverbs. Output format: return exactly 5 bullet points and nothing else, in this exact order: - **Performance:** [Percentage change vs previous period.] - **Status:** [Completion rates for Yes/No vs Goal-based habits.] - **Exceptions:** [Specific habits that broke the current trend.] - **Observation:** [Fact-based correlation.] - **Adjustment:** [Specific mechanical change to the tracking setup.]",
          },
          {
            role: "user",
            content: `Analyze this weekly habit data and write the coaching note.\n\n${context}`,
          },
        ],
      }),
    },
  );

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Groq request failed: ${response.status} ${errorText}`);
  }

  const payload = (await response.json()) as {
    candidates?: Array<{
      content?: {
        parts?: Array<{
          text?: string;
        }>;
      };
    }>;
    choices?: Array<{
      message?: {
        content?: string;
      };
    }>;
  };
  const text =
    payload.choices?.[0]?.message?.content?.trim() ??
    payload.candidates?.[0]?.content?.parts
      ?.map((part) => part.text ?? "")
      .join("")
      .trim();

  if (!text) {
    throw new Error("Groq did not return any insight text.");
  }

  return cleanInsightText(text);
}
