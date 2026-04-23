"use client";

import { useEffect, useRef, useState } from "react";
import { ArchiveButton } from "@/components/habits/archive-button";
import {
  MAX_HABIT_NAME_LENGTH,
  type HabitListItem,
  validateHabitName,
} from "@/lib/habits";

type HabitRowProps = {
  habit: HabitListItem;
  isTogglePending: boolean;
  onToggle: (habit: HabitListItem) => void;
  onRename: (
    habit: HabitListItem,
    newName: string,
  ) => Promise<{
    error?: string;
  }>;
};

export function HabitRow({
  habit,
  isTogglePending,
  onToggle,
  onRename,
}: HabitRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState(habit.name);
  const [isEditing, setIsEditing] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing && !isSaving) {
      setDraftName(habit.name);
    }
  }, [habit.name, isEditing, isSaving]);

  useEffect(() => {
    if (!isEditing) {
      return;
    }

    const input = inputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    input.setSelectionRange(input.value.length, input.value.length);
  }, [isEditing]);

  function handleStartEditing() {
    setDraftName(habit.name);
    setErrorMessage(null);
    setIsEditing(true);
  }

  function handleCancelEditing() {
    if (isSaving) {
      return;
    }

    setDraftName(habit.name);
    setErrorMessage(null);
    setIsEditing(false);
  }

  async function handleSave() {
    if (isSaving) {
      return;
    }

    const validationError = validateHabitName(draftName);

    if (validationError) {
      setErrorMessage(validationError);
      return;
    }

    const trimmedName = draftName.trim();

    setErrorMessage(null);
    setIsSaving(true);

    const result = await onRename(habit, trimmedName);

    if (result.error) {
      setErrorMessage(result.error);
      setIsSaving(false);
      return;
    }

    setDraftName(trimmedName);
    setIsSaving(false);
    setIsEditing(false);
  }

  const isEditingView = isEditing || isSaving;

  return (
    <article className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {!isEditingView ? (
          <button
            type="button"
            role="checkbox"
            aria-checked={habit.completedToday}
            aria-label={`Toggle ${habit.name} for today`}
            onClick={() => onToggle(habit)}
            disabled={isTogglePending}
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
        ) : (
          <div className="mt-1 h-7 w-7 shrink-0 rounded-full bg-emerald-100/70" />
        )}

        <div className="min-w-0 flex-1">
          {isEditingView ? (
            <div>
              <label
                htmlFor={`habit-name-${habit.id}`}
                className="sr-only"
              >
                Edit habit name
              </label>
              <input
                id={`habit-name-${habit.id}`}
                ref={inputRef}
                type="text"
                value={draftName}
                maxLength={MAX_HABIT_NAME_LENGTH}
                onChange={(event) => setDraftName(event.target.value)}
                onKeyDown={(event) => {
                  if (event.key === "Enter") {
                    event.preventDefault();
                    void handleSave();
                  }

                  if (event.key === "Escape") {
                    event.preventDefault();
                    handleCancelEditing();
                  }
                }}
                disabled={isSaving}
                className="min-h-11 w-full rounded-2xl border border-slate-200 bg-white px-4 py-3 text-base font-medium text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
              />

              <div className="mt-3 flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void handleSave()}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isSaving ? "Saving..." : "Save"}
                </button>
                <button
                  type="button"
                  onClick={handleCancelEditing}
                  disabled={isSaving}
                  className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
              </div>

              {errorMessage ? (
                <p className="mt-2 text-sm text-rose-600">{errorMessage}</p>
              ) : (
                <p className="mt-2 text-sm text-slate-500">
                  Keep names clear and under {MAX_HABIT_NAME_LENGTH} characters.
                </p>
              )}
            </div>
          ) : (
            <div>
              <div className="flex flex-wrap items-center gap-2">
                <h3 className="text-lg font-semibold text-slate-900">
                  {habit.name}
                </h3>
                <button
                  type="button"
                  onClick={handleStartEditing}
                  aria-label={`Edit ${habit.name}`}
                  className="inline-flex h-9 w-9 items-center justify-center rounded-full border border-transparent bg-white text-slate-500 transition hover:border-slate-200 hover:text-slate-700 focus:outline-none focus:ring-4 focus:ring-emerald-100"
                >
                  <svg
                    viewBox="0 0 20 20"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="1.7"
                    className="h-4 w-4"
                    aria-hidden="true"
                  >
                    <path
                      d="M3.75 13.75 3 17l3.25-.75L15.5 7a1.768 1.768 0 0 0-2.5-2.5L3.75 13.75Z"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                    <path
                      d="m11.75 5.75 2.5 2.5"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    />
                  </svg>
                </button>
              </div>

              <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                <span className="rounded-full bg-white px-3 py-1">
                  {habit.completedToday ? "Completed today" : "Not done yet"}
                </span>
                <span className="rounded-full bg-white px-3 py-1">
                  {habit.streak} day{habit.streak === 1 ? "" : "s"} streak
                </span>
              </div>
            </div>
          )}
        </div>
      </div>

      {!isEditingView ? <ArchiveButton habitId={habit.id} /> : null}
    </article>
  );
}
