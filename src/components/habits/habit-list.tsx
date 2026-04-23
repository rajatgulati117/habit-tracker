"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  toggleHabitCompletion,
  updateHabitName,
} from "@/app/(protected)/actions";
import { HabitRow } from "@/components/habits/habit-row";
import type { HabitListItem } from "@/lib/habits";

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
    };

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

  async function handleRename(habit: HabitListItem, nextName: string) {
    updateOptimisticHabits({
      type: "rename",
      habitId: habit.id,
      nextName,
    });

    const result = await updateHabitName({
      habitId: habit.id,
      newName: nextName,
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
            <HabitRow
              key={habit.id}
              habit={habit}
              isTogglePending={isPending}
              onToggle={handleToggle}
              onRename={handleRename}
            />
          );
        })}
      </div>
    </section>
  );
}
