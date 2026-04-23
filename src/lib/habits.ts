export type HabitRow = {
  id: string;
  name: string;
  created_at: string;
};

export type HabitCompletionRow = {
  habit_id: string;
  completed_on: string;
};

export type HabitListItem = {
  id: string;
  name: string;
  createdAt: string;
  completedToday: boolean;
  streak: number;
};

export type TrailingDay = {
  iso: string;
  dayLabel: string;
  shortLabel: string;
  dateLabel: string;
};

export const MAX_HABIT_NAME_LENGTH = 100;

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

export function calculateCurrentStreak(
  completionDates: string[],
  todayIso = getTodayIso(),
) {
  const completionSet = new Set(completionDates);

  const anchorDate = completionSet.has(todayIso)
    ? todayIso
    : shiftIsoDate(todayIso, -1);

  if (!completionSet.has(anchorDate)) {
    return 0;
  }

  let streak = 0;
  let cursor = anchorDate;

  while (completionSet.has(cursor)) {
    streak += 1;
    cursor = shiftIsoDate(cursor, -1);
  }

  return streak;
}

export function calculateCompletionRate(completedDays: number, totalDays: number) {
  if (totalDays === 0) {
    return 0;
  }

  return Math.round((completedDays / totalDays) * 100);
}

export function isMissingHabitsTableError(
  error: { code?: string; message?: string } | null,
) {
  return error?.code === "PGRST205" || error?.message?.includes("schema cache");
}
