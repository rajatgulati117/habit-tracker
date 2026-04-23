"use client";

import { useOptimistic, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteHabitPermanently,
  restoreHabit,
} from "@/app/(protected)/actions";

export type ArchivedHabitListItem = {
  id: string;
  name: string;
  createdLabel: string;
};

type ArchivedHabitsListProps = {
  habits: ArchivedHabitListItem[];
};

type RemovePayload = {
  habitId: string;
};

export function ArchivedHabitsList({ habits }: ArchivedHabitsListProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [, startTransition] = useTransition();
  const [optimisticHabits, removeOptimisticHabit] = useOptimistic(
    habits,
    (state, payload: RemovePayload) =>
      state.filter((habit) => habit.id !== payload.habitId),
  );

  function setPending(habitId: string, isPending: boolean) {
    setPendingIds((current) => {
      const next = { ...current };

      if (isPending) {
        next[habitId] = true;
      } else {
        delete next[habitId];
      }

      return next;
    });
  }

  function refreshAfterSuccess() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleRestore(habit: ArchivedHabitListItem) {
    setNotice(null);
    setErrorMessage(null);
    removeOptimisticHabit({ habitId: habit.id });
    setPending(habit.id, true);

    const result = await restoreHabit({ habitId: habit.id });

    if (result.error) {
      setErrorMessage(result.error);
      setPending(habit.id, false);
      router.refresh();
      return;
    }

    setPending(habit.id, false);
    setNotice("Habit restored");
    refreshAfterSuccess();
  }

  async function handleDelete(habit: ArchivedHabitListItem) {
    const confirmed = window.confirm(
      `This will permanently delete ${habit.name} and all its completion history. This cannot be undone.`,
    );

    if (!confirmed) {
      return;
    }

    setNotice(null);
    setErrorMessage(null);
    removeOptimisticHabit({ habitId: habit.id });
    setPending(habit.id, true);

    const result = await deleteHabitPermanently({ habitId: habit.id });

    if (result.error) {
      setErrorMessage(result.error);
      setPending(habit.id, false);
      router.refresh();
      return;
    }

    setPending(habit.id, false);
    setNotice("Habit deleted");
    refreshAfterSuccess();
  }

  if (optimisticHabits.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-200 bg-white/85 p-8 text-center shadow-sm">
        {notice ? (
          <p className="mb-4 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
            {notice}
          </p>
        ) : null}
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          Nothing archived
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">
          No archived habits yet.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          When you archive a habit from the dashboard, it&apos;ll appear here.
        </p>
      </section>
    );
  }

  return (
    <section className="space-y-4">
      {notice ? (
        <p className="rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-700">
          {notice}
        </p>
      ) : null}

      {errorMessage ? (
        <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {optimisticHabits.map((habit) => {
        const isPending = Boolean(pendingIds[habit.id]);

        return (
          <article
            key={habit.id}
            className="rounded-[1.75rem] border border-slate-100 bg-white/85 p-5 shadow-sm"
          >
            <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
              <div className="min-w-0">
                <h2 className="text-lg font-semibold text-slate-900">
                  {habit.name}
                </h2>
                <p className="mt-2 text-sm text-slate-500">{habit.createdLabel}</p>
              </div>

              <div className="flex w-full flex-col gap-2 sm:w-auto sm:min-w-[12rem]">
                <button
                  type="button"
                  onClick={() => void handleRestore(habit)}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isPending ? "Working..." : "Restore"}
                </button>
                <button
                  type="button"
                  onClick={() => void handleDelete(habit)}
                  disabled={isPending}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Delete permanently
                </button>
              </div>
            </div>
          </article>
        );
      })}
    </section>
  );
}
