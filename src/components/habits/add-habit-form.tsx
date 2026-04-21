"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addHabit } from "@/app/(protected)/actions";

export function AddHabitForm() {
  const router = useRouter();
  const [name, setName] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const result = await addHabit({ name });

        if (result.error) {
          setErrorMessage(result.error);
          return;
        }

        setName("");
        router.refresh();
      })();
    });
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur sm:p-6"
    >
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
            New Habit
          </p>
          <h2 className="mt-2 text-xl font-semibold text-slate-900">
            Add something worth repeating
          </h2>
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-3 sm:flex-row">
        <input
          type="text"
          value={name}
          onChange={(event) => setName(event.target.value)}
          placeholder="Drink water"
          maxLength={120}
          className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
        />
        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-12 items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isPending ? "Adding..." : "Add habit"}
        </button>
      </div>

      {errorMessage ? (
        <p className="mt-3 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : (
        <p className="mt-3 text-sm text-slate-500">
          Keep habit names short and specific so they stay easy to scan.
        </p>
      )}
    </form>
  );
}
