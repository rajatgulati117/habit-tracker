export type HabitType = "boolean" | "quantified";
export type FrequencyType = "daily" | "weekly_count" | "specific_days";

export type HabitRow = {
  id: string;
  name: string;
  created_at: string;
  category_id?: string | null;
  habit_type?: HabitType;
  target_value?: number | null;
  unit?: string | null;
  frequency_type?: FrequencyType;
  frequency_value?: number | null;
  frequency_days?: number[] | null;
};

export type HabitCompletionRow = {
  habit_id: string;
  completed_on: string;
  value?: number | null;
};

export type HabitScheduleConfig = {
  createdAt: string;
  frequencyType: FrequencyType;
  frequencyValue: number | null;
  frequencyDays: number[] | null;
};

export type HabitListItem = {
  id: string;
  name: string;
  createdAt: string;
  completedToday: boolean;
  streak: number;
  categoryId: string | null;
  categoryName: string | null;
  categoryColor: string | null;
  habitType: HabitType;
  targetValue: number | null;
  unit: string | null;
  currentValue: number | null;
  frequencyType: FrequencyType;
  frequencyValue: number | null;
  frequencyDays: number[];
  expectedToday: boolean;
  completionDates: string[];
};

export type HabitCategoryGroup = {
  key: string;
  name: string;
  color: string | null;
  habits: HabitListItem[];
  isUncategorized: boolean;
};

export type TrailingDay = {
  iso: string;
  dayLabel: string;
  shortLabel: string;
  dateLabel: string;
};

export type HabitStreakSummary = {
  current: number;
  longest: number;
};

export type HabitDayStatus = {
  expected: boolean;
  completed: boolean;
  value: number | null;
  progressPercent: number;
  state: "completed" | "missed" | "not_expected";
};

export const MAX_HABIT_NAME_LENGTH = 100;
export const MAX_HABIT_UNIT_LENGTH = 30;
export const MAX_WEEKLY_FREQUENCY_VALUE = 7;

const WEEKDAY_OPTIONS = [
  { value: 0, label: "Sun" },
  { value: 1, label: "Mon" },
  { value: 2, label: "Tue" },
  { value: 3, label: "Wed" },
  { value: 4, label: "Thu" },
  { value: 5, label: "Fri" },
  { value: 6, label: "Sat" },
] as const;

function getCreatedOnIso(createdAt: string) {
  if (createdAt.length >= 10 && createdAt[4] === "-" && createdAt[7] === "-") {
    return createdAt.slice(0, 10);
  }

  return formatLocalDateToIso(new Date(createdAt));
}

function summarizePeriods(periods: Array<{ completed: boolean }>): HabitStreakSummary {
  if (periods.length === 0) {
    return { current: 0, longest: 0 };
  }

  let longest = 0;
  let run = 0;

  periods.forEach((period) => {
    if (period.completed) {
      run += 1;
      longest = Math.max(longest, run);
      return;
    }

    run = 0;
  });

  let index = periods.length - 1;

  while (index >= 0 && !periods[index].completed) {
    index -= 1;
  }

  let current = 0;

  while (index >= 0 && periods[index].completed) {
    current += 1;
    index -= 1;
  }

  return { current, longest };
}

function buildScheduledDayPeriods(
  config: HabitScheduleConfig,
  completionSet: Set<string>,
  todayIso: string,
) {
  const createdOnIso = getCreatedOnIso(config.createdAt);
  const periods: Array<{ key: string; completed: boolean }> = [];

  for (let cursor = createdOnIso; cursor <= todayIso; cursor = shiftIsoDate(cursor, 1)) {
    if (!isHabitExpectedOnDate(config, cursor)) {
      continue;
    }

    periods.push({
      key: cursor,
      completed: completionSet.has(cursor),
    });
  }

  return periods;
}

function buildWeeklyCountPeriods(
  config: HabitScheduleConfig,
  completionSet: Set<string>,
  todayIso: string,
) {
  const createdOnIso = getCreatedOnIso(config.createdAt);
  const target = config.frequencyValue ?? 0;

  if (target <= 0) {
    return [];
  }

  const periods: Array<{ key: string; completed: boolean }> = [];
  const lastWeekStart = getWeekStartIso(todayIso);

  for (
    let weekStart = getWeekStartIso(createdOnIso);
    weekStart <= lastWeekStart;
    weekStart = shiftIsoDate(weekStart, 7)
  ) {
    const effectiveStart = weekStart < createdOnIso ? createdOnIso : weekStart;
    const effectiveEnd = minIsoDate(shiftIsoDate(weekStart, 6), todayIso);
    let completedDays = 0;

    for (
      let cursor = effectiveStart;
      cursor <= effectiveEnd;
      cursor = shiftIsoDate(cursor, 1)
    ) {
      if (completionSet.has(cursor)) {
        completedDays += 1;
      }
    }

    periods.push({
      key: weekStart,
      completed: completedDays >= target,
    });
  }

  return periods;
}

export function validateHabitName(name: string) {
  const trimmedName = name.trim();

  if (!trimmedName) {
    return "Enter a habit name.";
  }

  if (trimmedName.length > MAX_HABIT_NAME_LENGTH) {
    return `Habit names must be ${MAX_HABIT_NAME_LENGTH} characters or fewer.`;
  }

  return null;
}

export function validateTargetValue(
  value: number | null | undefined,
  habitType: HabitType,
) {
  if (habitType !== "quantified") {
    return null;
  }

  if (value == null || Number.isNaN(value)) {
    return "Enter a target value for quantified habits.";
  }

  if (value <= 0) {
    return "Target values must be greater than 0.";
  }

  return null;
}

export function validateHabitUnit(unit: string | null | undefined) {
  const trimmedUnit = unit?.trim() ?? "";

  if (trimmedUnit.length > MAX_HABIT_UNIT_LENGTH) {
    return `Units must be ${MAX_HABIT_UNIT_LENGTH} characters or fewer.`;
  }

  return null;
}

export function normalizeFrequencyDays(days: number[] | null | undefined) {
  if (!days?.length) {
    return [];
  }

  return Array.from(
    new Set(
      days.filter(
        (day) => Number.isInteger(day) && day >= 0 && day <= 6,
      ),
    ),
  ).sort((left, right) => left - right);
}

export function validateFrequencyValue(
  value: number | null | undefined,
  frequencyType: FrequencyType,
) {
  if (frequencyType !== "weekly_count") {
    return null;
  }

  if (value == null || Number.isNaN(value)) {
    return "Choose how many times per week this habit should happen.";
  }

  if (!Number.isInteger(value) || value < 1 || value > MAX_WEEKLY_FREQUENCY_VALUE) {
    return `Weekly targets must be a whole number between 1 and ${MAX_WEEKLY_FREQUENCY_VALUE}.`;
  }

  return null;
}

export function validateFrequencyDays(days: number[] | null | undefined) {
  const normalizedDays = normalizeFrequencyDays(days);

  if (normalizedDays.length === 0) {
    return "Pick at least one day.";
  }

  return null;
}

export function validateHabitFrequency(config: {
  frequencyType: FrequencyType;
  frequencyValue?: number | null;
  frequencyDays?: number[] | null;
}) {
  if (config.frequencyType === "daily") {
    return null;
  }

  if (config.frequencyType === "weekly_count") {
    return validateFrequencyValue(config.frequencyValue, config.frequencyType);
  }

  if (config.frequencyType === "specific_days") {
    return validateFrequencyDays(config.frequencyDays);
  }

  return "Choose a valid frequency.";
}

export function formatLocalDateToIso(date: Date) {
  const year = date.getFullYear();
  const month = `${date.getMonth() + 1}`.padStart(2, "0");
  const day = `${date.getDate()}`.padStart(2, "0");

  return `${year}-${month}-${day}`;
}

export function getTodayIso() {
  return formatLocalDateToIso(new Date());
}

export function shiftIsoDate(isoDate: string, days: number) {
  const [year, month, day] = isoDate.split("-").map(Number);
  const date = new Date(year, month - 1, day);
  date.setDate(date.getDate() + days);

  return formatLocalDateToIso(date);
}

export function parseIsoDate(isoDate: string) {
  const [year, month, day] = isoDate.split("-").map(Number);

  return new Date(year, month - 1, day);
}

export function getDayOfWeek(isoDate: string) {
  return parseIsoDate(isoDate).getDay();
}

export function getWeekStartIso(isoDate: string) {
  const date = parseIsoDate(isoDate);
  const day = (date.getDay() + 6) % 7;
  date.setDate(date.getDate() - day);

  return formatLocalDateToIso(date);
}

export function minIsoDate(left: string, right: string) {
  return left <= right ? left : right;
}

export function getTrailingDays(endIso = getTodayIso(), count = 7): TrailingDay[] {
  return Array.from({ length: count }, (_, index) => {
    const iso = shiftIsoDate(endIso, index - (count - 1));
    const date = parseIsoDate(iso);

    return {
      iso,
      dayLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "short",
      }).format(date),
      shortLabel: new Intl.DateTimeFormat("en-US", {
        weekday: "narrow",
      }).format(date),
      dateLabel: new Intl.DateTimeFormat("en-US", {
        month: "short",
        day: "numeric",
      }).format(date),
    };
  });
}

export function formatTodayLabel(date = new Date()) {
  return new Intl.DateTimeFormat("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
  }).format(date);
}

export function isHabitCompletedForValue(
  habitType: HabitType,
  value: number | null | undefined,
  targetValue: number | null | undefined,
) {
  if (habitType === "boolean") {
    return true;
  }

  if (value == null || targetValue == null) {
    return false;
  }

  return value >= targetValue;
}

export function isHabitDayCompleted(
  hasCompletion: boolean,
  habitType: HabitType,
  value: number | null | undefined,
  targetValue: number | null | undefined,
) {
  if (!hasCompletion) {
    return false;
  }

  return isHabitCompletedForValue(habitType, value, targetValue);
}

export function isHabitExpectedOnDate(
  config: HabitScheduleConfig,
  isoDate: string,
) {
  const createdOnIso = getCreatedOnIso(config.createdAt);

  if (isoDate < createdOnIso) {
    return false;
  }

  if (config.frequencyType === "daily" || config.frequencyType === "weekly_count") {
    return true;
  }

  const normalizedDays = normalizeFrequencyDays(config.frequencyDays);
  return normalizedDays.includes(getDayOfWeek(isoDate));
}

export function calculateHabitStreaks(
  config: HabitScheduleConfig,
  qualifyingCompletionDates: string[],
  todayIso = getTodayIso(),
): HabitStreakSummary {
  const completionSet = new Set(Array.from(new Set(qualifyingCompletionDates)).sort());

  const periods =
    config.frequencyType === "weekly_count"
      ? buildWeeklyCountPeriods(config, completionSet, todayIso)
      : buildScheduledDayPeriods(config, completionSet, todayIso);

  return summarizePeriods(periods);
}

export function getHabitDayStatus(input: {
  createdAt: string;
  frequencyType: FrequencyType;
  frequencyValue: number | null;
  frequencyDays: number[] | null;
  habitType: HabitType;
  targetValue: number | null;
  iso: string;
  hasCompletion: boolean;
  value: number | null | undefined;
}) {
  const expected = isHabitExpectedOnDate(
    {
      createdAt: input.createdAt,
      frequencyType: input.frequencyType,
      frequencyValue: input.frequencyValue,
      frequencyDays: input.frequencyDays,
    },
    input.iso,
  );
  const completed = isHabitDayCompleted(
    input.hasCompletion,
    input.habitType,
    input.value,
    input.targetValue,
  );
  const progressPercent =
    input.habitType === "quantified"
      ? getProgressPercent(input.value ?? null, input.targetValue)
      : completed
        ? 100
        : 0;

  return {
    expected,
    completed,
    value: input.value ?? null,
    progressPercent,
    state: completed ? "completed" : expected ? "missed" : "not_expected",
  } satisfies HabitDayStatus;
}

export function normalizeCompletionValue(value: number | null | undefined) {
  if (value == null || Number.isNaN(value)) {
    return null;
  }

  if (value <= 0) {
    return 0;
  }

  return Number(value.toFixed(2));
}

export function formatProgressValue(value: number | null | undefined) {
  if (value == null) {
    return "0";
  }

  return Number.isInteger(value) ? `${value}` : value.toFixed(1);
}

export function formatHabitTarget(targetValue: number | null, unit: string | null) {
  if (targetValue == null) {
    return unit?.trim() ? unit : "";
  }

  const valueText = formatProgressValue(targetValue);
  return unit?.trim() ? `${valueText} ${unit.trim()}` : valueText;
}

export function formatQuantifiedProgress(
  currentValue: number | null,
  targetValue: number | null,
  unit: string | null,
) {
  const currentText = formatProgressValue(currentValue);
  const targetText = formatProgressValue(targetValue);

  return unit?.trim()
    ? `${currentText} / ${targetText} ${unit.trim()}`
    : `${currentText} / ${targetText}`;
}

export function getProgressPercent(
  currentValue: number | null | undefined,
  targetValue: number | null | undefined,
) {
  if (currentValue == null || targetValue == null || targetValue <= 0) {
    return 0;
  }

  return Math.max(0, Math.min(100, Math.round((currentValue / targetValue) * 100)));
}

export function calculateCompletionRate(completedDays: number, totalDays: number) {
  if (totalDays === 0) {
    return 0;
  }

  return Math.round((completedDays / totalDays) * 100);
}

export function getFrequencyDayOptions() {
  return WEEKDAY_OPTIONS.map((option) => ({ ...option }));
}

export function formatHabitFrequency(
  frequencyType: FrequencyType,
  frequencyValue: number | null,
  frequencyDays: number[] | null,
) {
  if (frequencyType === "daily") {
    return "Every day";
  }

  if (frequencyType === "weekly_count") {
    const count = frequencyValue ?? 0;
    return `${count} time${count === 1 ? "" : "s"} per week`;
  }

  const normalizedDays = normalizeFrequencyDays(frequencyDays);

  return normalizedDays
    .map((day) => WEEKDAY_OPTIONS.find((option) => option.value === day)?.label ?? "")
    .filter(Boolean)
    .join(", ");
}

export function getStreakUnitLabel(frequencyType: FrequencyType, streak: number) {
  const singular = frequencyType === "weekly_count" ? "week" : "day";
  return `${streak} ${singular}${streak === 1 ? "" : "s"} streak`;
}

export function isMissingHabitsTableError(
  error: { code?: string; message?: string } | null,
) {
  return (
    error?.code === "PGRST205" ||
    error?.code === "42703" ||
    error?.code === "42P01" ||
    error?.message?.includes("schema cache") ||
    error?.message?.includes("Could not find the table") ||
    error?.message?.includes("column") ||
    error?.message?.includes("relation")
  );
}

export function groupHabitItemsByCategory(habits: HabitListItem[]) {
  const categoryGroups = new Map<string, HabitCategoryGroup>();
  const uncategorizedHabits: HabitListItem[] = [];

  habits.forEach((habit) => {
    if (!habit.categoryId || !habit.categoryName) {
      uncategorizedHabits.push(habit);
      return;
    }

    const existingGroup = categoryGroups.get(habit.categoryId);

    if (existingGroup) {
      existingGroup.habits.push(habit);
      return;
    }

    categoryGroups.set(habit.categoryId, {
      key: habit.categoryId,
      name: habit.categoryName,
      color: habit.categoryColor,
      habits: [habit],
      isUncategorized: false,
    });
  });

  const orderedGroups = Array.from(categoryGroups.values()).sort((left, right) =>
    left.name.localeCompare(right.name),
  );

  if (uncategorizedHabits.length > 0) {
    orderedGroups.push({
      key: "uncategorized",
      name: "Uncategorized",
      color: null,
      habits: uncategorizedHabits,
      isUncategorized: true,
    });
  }

  return orderedGroups;
}
