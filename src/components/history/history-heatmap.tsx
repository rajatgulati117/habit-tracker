"use client";

import { useEffect, useMemo, useState } from "react";
import {
  formatHabitTarget,
  formatQuantifiedProgress,
  formatLocalDateToIso,
  getHabitDayStatus,
  getStreakUnitLabel,
  parseIsoDate,
  shiftIsoDate,
  type FrequencyType,
  type HabitType,
} from "@/lib/habits";

export type HistoryHeatmapHabit = {
  id: string;
  name: string;
  habitType: HabitType;
  targetValue: number | null;
  unit: string | null;
  frequencyType: FrequencyType;
  frequencyValue: number | null;
  frequencyDays: number[];
  frequencyLabel: string;
  createdAt: string;
  color: string | null;
  completedDays180: number;
  currentStreak: number;
  longestStreak: number;
  dailyValues: Array<{
    iso: string;
    value: number | null;
    completed: boolean;
  }>;
};

type HistoryHeatmapProps = {
  habits: HistoryHeatmapHabit[];
  todayIso: string;
};

type ActiveCell = {
  habitId: string;
  description: string;
};

const DESKTOP_DAY_COUNT = 180;
const MOBILE_DAY_COUNT = 90;

function withOpacity(hexColor: string, alpha: string) {
  return `${hexColor}${alpha}`;
}

function startOfWeek(date: Date, firstDayOfWeek: number) {
  const nextDate = new Date(date);
  const offset = (nextDate.getDay() - firstDayOfWeek + 7) % 7;
  nextDate.setDate(nextDate.getDate() - offset);
  return nextDate;
}

function endOfWeek(date: Date, firstDayOfWeek: number) {
  const nextDate = startOfWeek(date, firstDayOfWeek);
  nextDate.setDate(nextDate.getDate() + 6);
  return nextDate;
}

function getFirstDayOfWeek(locale: string) {
  try {
    const localeInfo = new Intl.Locale(locale) as Intl.Locale & {
      weekInfo?: {
        firstDay?: number;
      };
    };
    const weekInfo = localeInfo.weekInfo;

    if (weekInfo?.firstDay) {
      return weekInfo.firstDay % 7;
    }
  } catch {
    return 1;
  }

  return 1;
}

function getDayLabels(locale: string, firstDayOfWeek: number) {
  const anchorSunday = new Date(2023, 11, 31);

  return Array.from({ length: 7 }, (_, index) => {
    const day = new Date(anchorSunday);
    day.setDate(anchorSunday.getDate() + ((index + firstDayOfWeek) % 7));

    return new Intl.DateTimeFormat(locale, {
      weekday: "short",
    }).format(day);
  });
}

function getCellDescription(
  habit: HistoryHeatmapHabit,
  iso: string,
  value: number | null,
  completed: boolean,
  expected: boolean,
  locale: string,
) {
  const dateLabel = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(parseIsoDate(iso));

  if (habit.habitType === "boolean") {
    if (completed && !expected) {
      return `${dateLabel}: Completed on an unscheduled day`;
    }

    if (!expected) {
      return `${dateLabel}: Not scheduled`;
    }

    return `${dateLabel}: ${completed ? "Completed" : "Expected but missed"}`;
  }

  if (!expected && !completed) {
    return `${dateLabel}: Not scheduled`;
  }

  if (!expected && completed) {
    return `${dateLabel}: ${formatQuantifiedProgress(value, habit.targetValue, habit.unit)} on an unscheduled day`;
  }

  return `${dateLabel}: ${formatQuantifiedProgress(value, habit.targetValue, habit.unit)}${
    completed ? " (target reached)" : " (expected but missed)"
  }`;
}

function getQuantifiedShade(ratio: number, color: string) {
  if (ratio <= 0) {
    return {
      backgroundColor: undefined,
      borderColor: undefined,
    };
  }

  if (ratio <= 0.33) {
    return {
      backgroundColor: withOpacity(color, "22"),
      borderColor: withOpacity(color, "44"),
    };
  }

  if (ratio <= 0.66) {
    return {
      backgroundColor: withOpacity(color, "4D"),
      borderColor: withOpacity(color, "66"),
    };
  }

  if (ratio < 1) {
    return {
      backgroundColor: withOpacity(color, "7A"),
      borderColor: withOpacity(color, "99"),
    };
  }

  return {
    backgroundColor: color,
    borderColor: color,
  };
}

function buildColumns(
  habit: HistoryHeatmapHabit,
  todayIso: string,
  visibleDayCount: number,
  locale: string,
  firstDayOfWeek: number,
) {
  const startIso = shiftIsoDate(todayIso, -(visibleDayCount - 1));
  const startDate = parseIsoDate(startIso);
  const endDate = parseIsoDate(todayIso);
  const gridStart = startOfWeek(startDate, firstDayOfWeek);
  const gridEnd = endOfWeek(endDate, firstDayOfWeek);
  const dayLookup = new Map(
    habit.dailyValues.map((day) => [day.iso, { value: day.value, completed: day.completed }]),
  );
  const monthFormatter = new Intl.DateTimeFormat(locale, {
    month: "short",
  });

  const columns: Array<{
    key: string;
    monthLabel: string;
    cells: Array<{
      key: string;
      iso: string;
      hidden: boolean;
      description: string;
      completed: boolean;
      expected: boolean;
      value: number | null;
      progressPercent: number;
      style?: {
        backgroundColor?: string;
        borderColor?: string;
      };
    }>;
  }> = [];

  const cursor = new Date(gridStart);
  let previousMonthKey = "";

  while (cursor <= gridEnd) {
    const weekCells: Array<{
      key: string;
      iso: string;
      hidden: boolean;
      description: string;
      completed: boolean;
      expected: boolean;
      value: number | null;
      progressPercent: number;
      style?: {
        backgroundColor?: string;
        borderColor?: string;
      };
    }> = [];
    let monthLabel = "";

    for (let row = 0; row < 7; row += 1) {
      const iso = formatLocalDateToIso(cursor);
      const hidden = iso < startIso || iso > todayIso;
      const dayEntry = dayLookup.get(iso);
      const progressPercent =
        habit.habitType === "quantified"
          ? getHabitDayStatus({
              createdAt: habit.createdAt,
              frequencyType: habit.frequencyType,
              frequencyValue: habit.frequencyValue,
              frequencyDays: habit.frequencyDays,
              habitType: habit.habitType,
              targetValue: habit.targetValue,
              iso,
              hasCompletion: Boolean(dayEntry),
              value: dayEntry?.value ?? null,
            }).progressPercent
          : dayEntry?.completed
            ? 100
            : 0;
      const dayStatus = getHabitDayStatus({
        createdAt: habit.createdAt,
        frequencyType: habit.frequencyType,
        frequencyValue: habit.frequencyValue,
        frequencyDays: habit.frequencyDays,
        habitType: habit.habitType,
        targetValue: habit.targetValue,
        iso,
        hasCompletion: Boolean(dayEntry),
        value: dayEntry?.value ?? null,
      });

      if (!hidden && monthLabel === "") {
        const monthKey = iso.slice(0, 7);

        if (monthKey !== previousMonthKey) {
          monthLabel = monthFormatter.format(cursor);
          previousMonthKey = monthKey;
        }
      }

      weekCells.push({
        key: `${habit.id}-${iso}`,
        iso,
        hidden,
        description: getCellDescription(
          habit,
          iso,
          dayEntry?.value ?? null,
          dayStatus.completed,
          dayStatus.expected,
          locale,
        ),
        completed: dayStatus.completed,
        expected: dayStatus.expected,
        value: dayEntry?.value ?? null,
        progressPercent,
        style:
          hidden || !habit.color
            ? undefined
            : habit.habitType === "boolean"
              ? dayStatus.completed
                ? {
                    backgroundColor: habit.color,
                    borderColor: habit.color,
                  }
                : dayStatus.expected
                  ? {
                      backgroundColor: "#ffffff",
                      borderColor: "#fca5a5",
                    }
                  : {
                      backgroundColor: "#f1f5f9",
                      borderColor: "#e2e8f0",
                    }
              : dayStatus.expected
                ? dayStatus.completed
                  ? getQuantifiedShade(progressPercent / 100, habit.color)
                  : progressPercent > 0
                    ? {
                        ...getQuantifiedShade(progressPercent / 100, habit.color),
                        borderColor: "#fca5a5",
                      }
                    : {
                        backgroundColor: "#ffffff",
                        borderColor: "#fca5a5",
                      }
                : progressPercent > 0
                  ? getQuantifiedShade(progressPercent / 100, habit.color)
                  : {
                      backgroundColor: "#f1f5f9",
                      borderColor: "#e2e8f0",
                    },
      });

      cursor.setDate(cursor.getDate() + 1);
    }

    columns.push({
      key: `${habit.id}-week-${columns.length}`,
      monthLabel,
      cells: weekCells,
    });
  }

  return columns;
}

export function HistoryHeatmap({ habits, todayIso }: HistoryHeatmapProps) {
  const [visibleDayCount, setVisibleDayCount] = useState(DESKTOP_DAY_COUNT);
  const [activeCell, setActiveCell] = useState<ActiveCell | null>(null);
  const locale =
    typeof navigator === "undefined" ? "en-IN" : navigator.language || "en-IN";
  const firstDayOfWeek = useMemo(() => getFirstDayOfWeek(locale), [locale]);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(max-width: 640px)");

    function syncDayCount() {
      setVisibleDayCount(mediaQuery.matches ? MOBILE_DAY_COUNT : DESKTOP_DAY_COUNT);
    }

    syncDayCount();
    mediaQuery.addEventListener("change", syncDayCount);

    return () => mediaQuery.removeEventListener("change", syncDayCount);
  }, []);

  const dayLabels = useMemo(
    () => getDayLabels(locale, firstDayOfWeek),
    [firstDayOfWeek, locale],
  );

  return (
    <section className="space-y-6">
      {habits.map((habit) => {
        const columns = buildColumns(
          habit,
          todayIso,
          visibleDayCount,
          locale,
          firstDayOfWeek,
        );
        const activeDescription =
          activeCell?.habitId === habit.id ? activeCell.description : null;

        return (
          <article
            key={habit.id}
            className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm sm:p-6"
          >
            <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
              <div>
                <p className="text-xl font-semibold text-slate-900">{habit.name}</p>
                {habit.habitType === "quantified" ? (
                  <p className="mt-2 text-sm text-slate-500">
                    Target: {formatHabitTarget(habit.targetValue, habit.unit)}
                  </p>
                ) : null}
                <p className="mt-2 text-sm text-slate-500">
                  Schedule: {habit.frequencyLabel}
                </p>
              </div>

              <div className="grid gap-3 sm:grid-cols-3">
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Last 180 days
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {habit.completedDays180}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Longest streak
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {habit.longestStreak}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {getStreakUnitLabel(habit.frequencyType, habit.longestStreak)}
                  </p>
                </div>
                <div className="rounded-2xl border border-slate-100 bg-slate-50/80 px-4 py-3">
                  <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
                    Current streak
                  </p>
                  <p className="mt-2 text-2xl font-semibold text-slate-900">
                    {habit.currentStreak}
                  </p>
                  <p className="mt-1 text-xs text-slate-500">
                    {getStreakUnitLabel(habit.frequencyType, habit.currentStreak)}
                  </p>
                </div>
              </div>
            </div>

            <div className="mt-5 rounded-[1.5rem] border border-slate-100 bg-slate-50/70 p-4 sm:p-5">
              <div className="mb-3 hidden min-h-[2.75rem] items-center sm:flex">
                {activeDescription ? (
                  <div className="inline-flex rounded-full border border-slate-200 bg-white px-4 py-2 text-sm text-slate-700 shadow-sm">
                    {activeDescription}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Hover a cell to inspect that day.
                  </p>
                )}
              </div>

              <div className="overflow-x-auto">
                <div className="inline-flex gap-3">
                  <div className="grid min-w-[3rem] grid-rows-8 gap-2 pt-[1.65rem]">
                    <div />
                    {dayLabels.map((label) => (
                      <div
                        key={`${habit.id}-${label}`}
                        className="flex h-3 items-center text-[11px] font-medium text-slate-400"
                      >
                        {label}
                      </div>
                    ))}
                  </div>

                  <div className="space-y-2">
                    <div className="flex gap-1.5 pl-0.5 text-[11px] font-medium text-slate-400">
                      {columns.map((column) => (
                        <div
                          key={`${column.key}-month`}
                          className="w-3.5 sm:w-4"
                        >
                          {column.monthLabel}
                        </div>
                      ))}
                    </div>

                    <div className="flex gap-1.5">
                      {columns.map((column) => (
                        <div
                          key={column.key}
                          className="grid grid-rows-7 gap-1.5"
                          style={{ gridTemplateRows: "repeat(7, minmax(0, 1fr))" }}
                        >
                          {column.cells.map((cell) => (
                            <button
                              key={cell.key}
                              type="button"
                              title={cell.description}
                              disabled={cell.hidden}
                              onMouseEnter={() =>
                                setActiveCell({
                                  habitId: habit.id,
                                  description: cell.description,
                                })
                              }
                              onFocus={() =>
                                setActiveCell({
                                  habitId: habit.id,
                                  description: cell.description,
                                })
                              }
                              onMouseLeave={() =>
                                setActiveCell((current) =>
                                  current?.habitId === habit.id ? null : current,
                                )
                              }
                              onBlur={() =>
                                setActiveCell((current) =>
                                  current?.habitId === habit.id ? null : current,
                                )
                              }
                              onClick={() =>
                                setActiveCell({
                                  habitId: habit.id,
                                  description: cell.description,
                                })
                              }
                              className={`h-3.5 w-3.5 rounded-[4px] border transition sm:h-4 sm:w-4 ${
                                cell.hidden
                                  ? "pointer-events-none border-transparent bg-transparent opacity-0"
                                  : cell.completed
                                    ? "shadow-[inset_0_1px_0_rgba(255,255,255,0.22)]"
                                    : cell.expected
                                      ? "bg-white"
                                      : "bg-slate-100"
                              }`}
                              style={cell.style}
                              aria-label={cell.description}
                            />
                          ))}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </div>

              <div className="mt-4 sm:hidden">
                {activeDescription ? (
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm text-slate-700 shadow-sm">
                    {activeDescription}
                  </div>
                ) : (
                  <p className="text-sm text-slate-500">
                    Tap a cell to inspect that day.
                  </p>
                )}
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
