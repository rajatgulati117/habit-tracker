"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toggleHabitCompletion } from "@/app/(protected)/actions";
import type { HabitListItem } from "@/lib/habits";
import { ArchiveButton } from "@/components/habits/archive-button";

type HabitListProps = {
  habits: HabitListItem[];
  todayLabel: string;
};

type TogglePayload = {
  habitId: string;
  nextCompleted: boolean;
};

export function HabitList({ habits, todayLabel }: HabitListProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const [optimisticHabits, updateOptimisticHabits] = useOptimistic(
    habits,
    (state, payload: TogglePayload) =>
      state.map((habit) => {
        if (habit.id !== payload.habitId) {
          return habit;
        }

        const nextStreak = payload.nextCompleted
          ? habit.completedToday
            ? habit.streak
            : habit.streak > 0
              ? habit.streak + 1
              : 1
          : habit.completedToday
            ? Math.max(habit.streak - 1, 0)
            : habit.streak;

        return {
          ...habit,
          completedToday: payload.nextCompleted,
          streak: nextStreak,
        };
      }),
  );

  function handleToggle(habit: HabitListItem) {
    const nextCompleted = !habit.completedToday;
    setErrorMessage(null);

    updateOptimisticHabits({
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

      <div className="mt-6 space-y-4">
        {optimisticHabits.map((habit) => {
          const isPending = Boolean(pendingIds[habit.id]);

          return (
            <article
              key={habit.id}
              className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between"
            >
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  role="checkbox"
                  aria-checked={habit.completedToday}
                  aria-label={`Toggle ${habit.name} for today`}
                  onClick={() => handleToggle(habit)}
                  disabled={isPending}
                  className={`mt-1 inline-flex h-7 w-7 shrink-0 items-center justify-center rounded-full border transition ${
                    habit.completedToday
                      ? "border-emerald-500 bg-emerald-500 text-white"
                      : "border-slate-300 bg-white text-transparent"
                  } disabled:cursor-not-allowed disabled:opacity-60`}
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M16.704 5.29a1 1 0 0 1 .006 1.414l-7.2 7.25a1 1 0 0 1-1.42 0L3.3 9.165a1 1 0 1 1 1.414-1.414l4.086 4.085 6.493-6.54a1 1 0 0 1 1.411-.006Z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                <div>
                  <h3 className="text-lg font-semibold text-slate-900">
                    {habit.name}
                  </h3>
                  <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                    <span className="rounded-full bg-white px-3 py-1">
                      {habit.completedToday ? "Completed today" : "Not done yet"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {habit.streak} day{habit.streak === 1 ? "" : "s"} streak
                    </span>
                  </div>
                </div>
              </div>

              <ArchiveButton habitId={habit.id} />
            </article>
          );
        })}
      </div>
    </section>
  );
}
