"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toggleHabitCompletion,
  updateHabitName,
  updateQuantifiedHabitValue,
} from "@/app/(protected)/actions";
import { HabitRow } from "@/components/habits/habit-row";
import {
  calculateHabitStreaks,
  type FrequencyType,
  getTodayIso,
  getProgressPercent,
  groupHabitItemsByCategory,
  type HabitListItem,
} from "@/lib/habits";

type HabitListProps = {
  habits: HabitListItem[];
  todayLabel: string;
};

type OptimisticPayload =
  | {
      type: "toggle";
      habitId: string;
      nextCompleted: boolean;
    }
  | {
      type: "rename";
      habitId: string;
      nextName: string;
    }
  | {
      type: "value";
      habitId: string;
      nextValue: number | null;
      nextCompleted: boolean;
    };

function getNextStreak(habit: HabitListItem, nextCompleted: boolean) {
  const completionDates = new Set(habit.completionDates);
  const todayIso = getTodayIso();

  if (nextCompleted) {
    completionDates.add(todayIso);
  } else {
    completionDates.delete(todayIso);
  }

  return calculateHabitStreaks(
    {
      createdAt: habit.createdAt,
      frequencyType: habit.frequencyType,
      frequencyValue: habit.frequencyValue,
      frequencyDays: habit.frequencyDays,
    },
    Array.from(completionDates),
    todayIso,
  ).current;
}

export function HabitList({ habits, todayLabel }: HabitListProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const [optimisticHabits, updateOptimisticHabits] = useOptimistic(
    habits,
    (state, payload: OptimisticPayload) =>
      state.map((habit) => {
        if (habit.id !== payload.habitId) {
          return habit;
        }

        if (payload.type === "rename") {
          return {
            ...habit,
            name: payload.nextName,
          };
        }

        if (payload.type === "value") {
          const nextCompletionDates = new Set(habit.completionDates);
          const todayIso = getTodayIso();

          if (payload.nextCompleted) {
            nextCompletionDates.add(todayIso);
          } else {
            nextCompletionDates.delete(todayIso);
          }

          return {
            ...habit,
            currentValue: payload.nextValue,
            completedToday: payload.nextCompleted,
            streak: getNextStreak(habit, payload.nextCompleted),
            completionDates: Array.from(nextCompletionDates).sort(),
          };
        }

        const nextCompletionDates = new Set(habit.completionDates);
        const todayIso = getTodayIso();

        if (payload.nextCompleted) {
          nextCompletionDates.add(todayIso);
        } else {
          nextCompletionDates.delete(todayIso);
        }

        return {
          ...habit,
          completedToday: payload.nextCompleted,
          streak: getNextStreak(habit, payload.nextCompleted),
          completionDates: Array.from(nextCompletionDates).sort(),
        };
      }),
  );

  function handleToggle(habit: HabitListItem) {
    const nextCompleted = !habit.completedToday;
    setErrorMessage(null);

    updateOptimisticHabits({
      type: "toggle",
      habitId: habit.id,
      nextCompleted,
    });
    setPendingIds((current) => ({
      ...current,
      [habit.id]: true,
    }));

    startTransition(() => {
      void (async () => {
        const result = await toggleHabitCompletion({
          habitId: habit.id,
          completed: nextCompleted,
        });

        if (result.error) {
          updateOptimisticHabits({
            type: "toggle",
            habitId: habit.id,
            nextCompleted: habit.completedToday,
          });
          setErrorMessage(result.error);
        } else {
          router.refresh();
        }

        setPendingIds((current) => {
          const next = { ...current };
          delete next[habit.id];
          return next;
        });
      })();
    });
  }

  function handleSetQuantifiedValue(habit: HabitListItem, nextValue: number) {
    const nextCompleted =
      habit.targetValue != null &&
      getProgressPercent(nextValue, habit.targetValue) >= 100;

    setErrorMessage(null);

    updateOptimisticHabits({
      type: "value",
      habitId: habit.id,
      nextValue,
      nextCompleted,
    });
    setPendingIds((current) => ({
      ...current,
      [habit.id]: true,
    }));

    startTransition(() => {
      void (async () => {
        const result = await updateQuantifiedHabitValue({
          habitId: habit.id,
          value: nextValue,
        });

        if (result.error) {
          updateOptimisticHabits({
            type: "value",
            habitId: habit.id,
            nextValue: habit.currentValue,
            nextCompleted: habit.completedToday,
          });
          setErrorMessage(result.error);
        } else {
          router.refresh();
        }

        setPendingIds((current) => {
          const next = { ...current };
          delete next[habit.id];
          return next;
        });
      })();
    });
  }

  async function handleRename(
    habit: HabitListItem,
    updates: {
      name: string;
      frequencyType: FrequencyType;
      frequencyValue: number | null;
      frequencyDays: number[];
    },
  ) {
    updateOptimisticHabits({
      type: "rename",
      habitId: habit.id,
      nextName: updates.name,
    });

    const result = await updateHabitName({
      habitId: habit.id,
      newName: updates.name,
      frequencyType: updates.frequencyType,
      frequencyValue: updates.frequencyValue,
      frequencyDays: updates.frequencyDays,
    });

    if (result.error) {
      updateOptimisticHabits({
        type: "rename",
        habitId: habit.id,
        nextName: habit.name,
      });
      return result;
    }

    startTransition(() => {
      router.refresh();
    });

    return result;
  }

  if (optimisticHabits.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-emerald-200 bg-white/75 p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          No active habits yet
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">
          Start with one small daily promise.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          Add your first habit and it will show up here with a daily checkbox,
          streak tracking, and archive controls.
        </p>
      </section>
    );
  }

  const expectedHabits = optimisticHabits.filter((habit) => habit.expectedToday);
  const notScheduledHabits = optimisticHabits.filter((habit) => !habit.expectedToday);
  const groupedHabits = groupHabitItemsByCategory(expectedHabits);
  const groupedNotScheduledHabits = groupHabitItemsByCategory(notScheduledHabits);

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur sm:p-6">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
            Active Habits
          </p>
          <h2 className="mt-2 text-2xl font-semibold text-slate-900">
            Mark off today and keep the streak alive
          </h2>
        </div>
        <p className="text-sm text-slate-500">Today: {todayLabel}</p>
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      <div className="mt-6 space-y-6">
        {groupedHabits.length > 0 ? (
          groupedHabits.map((group) => (
            <section key={group.key} className="space-y-4">
              <div
                className={`rounded-[1.5rem] border px-4 py-4 shadow-sm sm:px-5 ${
                  group.isUncategorized
                    ? "border-slate-200 bg-slate-50"
                    : "border-transparent bg-slate-900 text-white"
                }`}
                style={
                  group.color
                    ? {
                        backgroundColor: `${group.color}1A`,
                        borderColor: `${group.color}66`,
                      }
                    : undefined
                }
              >
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div className="flex items-center gap-3">
                    <span
                      className={`inline-flex h-3.5 w-3.5 rounded-full ${
                        group.isUncategorized ? "bg-slate-300" : ""
                      }`}
                      style={group.color ? { backgroundColor: group.color } : undefined}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-lg font-semibold text-slate-900">{group.name}</p>
                      <p className="text-sm text-slate-700">
                        {group.habits.length} habit{group.habits.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              <div className="space-y-4">
                {group.habits.map((habit) => {
                  const isPending = Boolean(pendingIds[habit.id]);

                  return (
                    <HabitRow
                      key={habit.id}
                      habit={habit}
                      isTogglePending={isPending}
                      onToggle={handleToggle}
                      onSetQuantifiedValue={handleSetQuantifiedValue}
                      onRename={handleRename}
                    />
                  );
                })}
              </div>
            </section>
          ))
        ) : (
          <div className="rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/70 p-6 text-sm text-slate-600">
            Nothing is scheduled for today. You can still log habits from the section below if you want to stay ahead.
          </div>
        )}

        {groupedNotScheduledHabits.length > 0 ? (
          <details className="rounded-[1.5rem] border border-slate-200 bg-slate-50/70 p-4 shadow-sm">
            <summary className="cursor-pointer list-none text-sm font-semibold text-slate-900">
              Not scheduled today ({notScheduledHabits.length})
            </summary>
            <p className="mt-2 text-sm text-slate-500">
              These habits are still active, but today isn&apos;t one of their scheduled periods.
            </p>

            <div className="mt-5 space-y-6">
              {groupedNotScheduledHabits.map((group) => (
                <section key={`later-${group.key}`} className="space-y-4">
                  <div className="flex items-center gap-3 rounded-[1.25rem] border border-slate-200 bg-white px-4 py-3">
                    <span
                      className={`inline-flex h-3 w-3 rounded-full ${
                        group.isUncategorized ? "bg-slate-300" : ""
                      }`}
                      style={group.color ? { backgroundColor: group.color } : undefined}
                      aria-hidden="true"
                    />
                    <div>
                      <p className="text-sm font-semibold text-slate-900">{group.name}</p>
                      <p className="text-xs text-slate-500">
                        {group.habits.length} habit{group.habits.length === 1 ? "" : "s"}
                      </p>
                    </div>
                  </div>

                  <div className="space-y-4">
                    {group.habits.map((habit) => {
                      const isPending = Boolean(pendingIds[habit.id]);

                      return (
                        <HabitRow
                          key={habit.id}
                          habit={habit}
                          isTogglePending={isPending}
                          onToggle={handleToggle}
                          onSetQuantifiedValue={handleSetQuantifiedValue}
                          onRename={handleRename}
                        />
                      );
                    })}
                  </div>
                </section>
              ))}
            </div>
          </details>
        ) : null}
      </div>
    </section>
  );
}
