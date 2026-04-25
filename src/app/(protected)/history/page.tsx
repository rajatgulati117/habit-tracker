import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import { type CategoryRow } from "@/lib/categories";
import {
  calculateHabitStreaks,
  formatHabitFrequency,
  getTodayIso,
  isHabitDayCompleted,
  isHabitCompletedForValue,
  isMissingHabitsTableError,
  shiftIsoDate,
  type HabitCompletionRow,
  type HabitRow,
} from "@/lib/habits";
import {
  HistoryHeatmap,
  type HistoryHeatmapHabit,
} from "@/components/history/history-heatmap";
import { InsightTimeline } from "@/components/insights/insight-timeline";
import { createClient } from "@/lib/supabase/server";
import { type WeeklyInsightRow } from "@/lib/weekly-insights";

function buildHistoryHabits(
  habits: HabitRow[],
  completions: HabitCompletionRow[],
  categories: CategoryRow[],
  todayIso: string,
) {
  const cutoffIso = shiftIsoDate(todayIso, -179);
  const categoriesById = new Map(categories.map((category) => [category.id, category]));
  const completionsByHabit = new Map<string, HabitCompletionRow[]>();

  completions.forEach((completion) => {
    const list = completionsByHabit.get(completion.habit_id) ?? [];
    list.push(completion);
    completionsByHabit.set(completion.habit_id, list);
  });

  return habits.map<HistoryHeatmapHabit>((habit) => {
    const habitCompletions = completionsByHabit.get(habit.id) ?? [];
    const streakSummary = calculateHabitStreaks(
      {
        createdAt: habit.created_at,
        frequencyType: habit.frequency_type ?? "daily",
        frequencyValue: habit.frequency_value ?? null,
        frequencyDays: habit.frequency_days ?? [],
      },
      habitCompletions
        .filter((completion) =>
          isHabitCompletedForValue(
            habit.habit_type ?? "boolean",
            completion.value ?? null,
            habit.target_value ?? null,
          ),
        )
        .map((completion) => completion.completed_on),
      todayIso,
    );
    const qualifyingDates = habitCompletions
      .filter((completion) =>
        isHabitCompletedForValue(
          habit.habit_type ?? "boolean",
          completion.value ?? null,
          habit.target_value ?? null,
        ),
      )
      .map((completion) => completion.completed_on);
    const recentDailyValues = habitCompletions
      .filter((completion) => completion.completed_on >= cutoffIso)
      .map((completion) => ({
        iso: completion.completed_on,
        value: completion.value ?? null,
        completed: isHabitDayCompleted(
          true,
          habit.habit_type ?? "boolean",
          completion.value ?? null,
          habit.target_value ?? null,
        ),
      }));

    return {
      id: habit.id,
      name: habit.name,
      habitType: habit.habit_type ?? "boolean",
      targetValue: habit.target_value ?? null,
      unit: habit.unit ?? null,
      frequencyType: habit.frequency_type ?? "daily",
      frequencyValue: habit.frequency_value ?? null,
      frequencyDays: habit.frequency_days ?? [],
      frequencyLabel: formatHabitFrequency(
        habit.frequency_type ?? "daily",
        habit.frequency_value ?? null,
        habit.frequency_days ?? [],
      ),
      createdAt: habit.created_at,
      color:
        (habit.category_id
          ? categoriesById.get(habit.category_id)?.color
          : null) ?? "#10B981",
      completedDays180: qualifyingDates.filter((iso) => iso >= cutoffIso).length,
      currentStreak: streakSummary.current,
      longestStreak: streakSummary.longest,
      dailyValues: recentDailyValues,
    };
  });
}

export default async function HistoryPage() {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const todayIso = getTodayIso();

  const [{ data: categoriesData, error: categoriesError }, { data: habitsData, error: habitsError }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, name, color, created_at")
        .eq("user_id", user.id),
      supabase
        .from("habits")
        .select(
          "id, name, created_at, category_id, habit_type, target_value, unit, frequency_type, frequency_value, frequency_days",
        )
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: true }),
    ]);

  if (categoriesError || habitsError) {
    const relevantError = categoriesError ?? habitsError;

    if (isMissingHabitsTableError(relevantError)) {
      return (
        <section className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            History unavailable
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            Run the latest Supabase migration before the extended history view can load.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            The heatmap needs the newest habit and completion schema first. Once
            that migration has been run, this page will render your last six months.
          </p>
        </section>
      );
    }

    throw new Error("Could not load history.");
  }

  const habits = (habitsData ?? []) as HabitRow[];
  const categories = (categoriesData ?? []) as CategoryRow[];
  const habitIds = habits.map((habit) => habit.id);

  let completions: HabitCompletionRow[] = [];

  if (habitIds.length > 0) {
    const { data: completionsData, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_on, value")
      .eq("user_id", user.id)
      .in("habit_id", habitIds)
      .order("completed_on", { ascending: true });

    if (completionsError) {
      throw new Error("Could not load history completions.");
    }

    completions = (completionsData ?? []) as HabitCompletionRow[];
  }

  const historyHabits = buildHistoryHabits(habits, completions, categories, todayIso);
  const { data: insightsData, error: insightsError } = await supabase
    .from("weekly_insights")
    .select("id, user_id, week_start, insight_text, generated_at")
    .eq("user_id", user.id)
    .order("week_start", { ascending: false });

  if (insightsError && !isMissingHabitsTableError(insightsError)) {
    throw new Error("Could not load past weekly insights.");
  }

  const weeklyInsights = (insightsData ?? []) as WeeklyInsightRow[];

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          Extended History
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              A contribution-style view of the habits that kept showing up.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Browse the last 180 days per habit, inspect any day, and spot where
              streaks became a pattern instead of a one-off.
            </p>
          </div>
        </div>
      </section>

      {historyHabits.length === 0 ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            No active habits yet
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Your contribution grids will appear once you add your first habit.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Start on the daily board, log a few days, and this page will begin
            filling in automatically.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Go to daily board
          </Link>
        </section>
      ) : (
        <HistoryHeatmap habits={historyHabits} todayIso={todayIso} />
      )}

      <InsightTimeline insights={weeklyInsights} />
    </div>
  );
}
