"use client";

import { useEffect, useRef, useState } from "react";
import { ArchiveButton } from "@/components/habits/archive-button";
import {
  formatHabitFrequency,
  getFrequencyDayOptions,
  getStreakUnitLabel,
  formatQuantifiedProgress,
  getProgressPercent,
  MAX_WEEKLY_FREQUENCY_VALUE,
  MAX_HABIT_NAME_LENGTH,
  normalizeFrequencyDays,
  normalizeCompletionValue,
  validateHabitFrequency,
  type FrequencyType,
  type HabitListItem,
  validateHabitName,
} from "@/lib/habits";

type HabitRowProps = {
  habit: HabitListItem;
  isTogglePending: boolean;
  onToggle: (habit: HabitListItem) => void;
  onSetQuantifiedValue: (habit: HabitListItem, nextValue: number) => void;
  onRename: (
    habit: HabitListItem,
    updates: {
      name: string;
      frequencyType: FrequencyType;
      frequencyValue: number | null;
      frequencyDays: number[];
    },
  ) => Promise<{
    error?: string;
  }>;
};

export function HabitRow({
  habit,
  isTogglePending,
  onToggle,
  onSetQuantifiedValue,
  onRename,
}: HabitRowProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const valueInputRef = useRef<HTMLInputElement>(null);
  const [draftName, setDraftName] = useState(habit.name);
  const [draftValue, setDraftValue] = useState(
    habit.currentValue != null ? `${habit.currentValue}` : "0",
  );
  const [draftFrequencyType, setDraftFrequencyType] = useState<FrequencyType>(
    habit.frequencyType,
  );
  const [draftFrequencyValue, setDraftFrequencyValue] = useState(
    habit.frequencyValue != null ? `${habit.frequencyValue}` : "3",
  );
  const [draftFrequencyDays, setDraftFrequencyDays] = useState<number[]>(
    habit.frequencyDays,
  );
  const [isEditing, setIsEditing] = useState(false);
  const [isEditingValue, setIsEditingValue] = useState(false);
  const [isSaving, setIsSaving] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [valueErrorMessage, setValueErrorMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!isEditing && !isSaving) {
      setDraftName(habit.name);
      setDraftFrequencyType(habit.frequencyType);
      setDraftFrequencyValue(
        habit.frequencyValue != null ? `${habit.frequencyValue}` : "3",
      );
      setDraftFrequencyDays(habit.frequencyDays);
    }
  }, [
    habit.frequencyDays,
    habit.frequencyType,
    habit.frequencyValue,
    habit.name,
    isEditing,
    isSaving,
  ]);

  useEffect(() => {
    if (!isEditingValue) {
      setDraftValue(habit.currentValue != null ? `${habit.currentValue}` : "0");
    }
  }, [habit.currentValue, isEditingValue]);

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

  useEffect(() => {
    if (!isEditingValue) {
      return;
    }

    const input = valueInputRef.current;

    if (!input) {
      return;
    }

    input.focus();
    input.select();
  }, [isEditingValue]);

  function handleStartEditing() {
    setDraftName(habit.name);
    setDraftFrequencyType(habit.frequencyType);
    setDraftFrequencyValue(
      habit.frequencyValue != null ? `${habit.frequencyValue}` : "3",
    );
    setDraftFrequencyDays(habit.frequencyDays);
    setErrorMessage(null);
    setIsEditing(true);
  }

  function handleCancelEditing() {
    if (isSaving) {
      return;
    }

    setDraftName(habit.name);
    setDraftFrequencyType(habit.frequencyType);
    setDraftFrequencyValue(
      habit.frequencyValue != null ? `${habit.frequencyValue}` : "3",
    );
    setDraftFrequencyDays(habit.frequencyDays);
    setErrorMessage(null);
    setIsEditing(false);
  }

  function toggleFrequencyDay(day: number) {
    setDraftFrequencyDays((current) => {
      const next = current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day];

      return normalizeFrequencyDays(next);
    });
  }

  function handleStartValueEditing() {
    setDraftValue(habit.currentValue != null ? `${habit.currentValue}` : "0");
    setValueErrorMessage(null);
    setIsEditingValue(true);
  }

  function handleCancelValueEditing() {
    setDraftValue(habit.currentValue != null ? `${habit.currentValue}` : "0");
    setValueErrorMessage(null);
    setIsEditingValue(false);
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
    const parsedFrequencyValue =
      draftFrequencyType === "weekly_count"
        ? Number(draftFrequencyValue)
        : null;
    const normalizedFrequencyDays = normalizeFrequencyDays(draftFrequencyDays);
    const frequencyError = validateHabitFrequency({
      frequencyType: draftFrequencyType,
      frequencyValue: parsedFrequencyValue,
      frequencyDays: normalizedFrequencyDays,
    });

    if (frequencyError) {
      setErrorMessage(frequencyError);
      return;
    }

    setErrorMessage(null);
    setIsSaving(true);

    const result = await onRename(habit, {
      name: trimmedName,
      frequencyType: draftFrequencyType,
      frequencyValue: parsedFrequencyValue,
      frequencyDays: normalizedFrequencyDays,
    });

    if (result.error) {
      setErrorMessage(result.error);
      setIsSaving(false);
      return;
    }

    setDraftName(trimmedName);
    setDraftFrequencyValue(
      parsedFrequencyValue != null ? `${parsedFrequencyValue}` : "3",
    );
    setDraftFrequencyDays(normalizedFrequencyDays);
    setIsSaving(false);
    setIsEditing(false);
  }

  function handleCommitValue(nextValue: number) {
    onSetQuantifiedValue(habit, nextValue);
    setIsEditingValue(false);
  }

  function handleSaveValue() {
    const parsedValue = Number(draftValue);
    const normalizedValue = normalizeCompletionValue(parsedValue);

    if (normalizedValue == null) {
      setValueErrorMessage("Enter a valid number.");
      return;
    }

    setValueErrorMessage(null);
    handleCommitValue(normalizedValue);
  }

  const isEditingView = isEditing || isSaving;
  const progressPercent = getProgressPercent(habit.currentValue, habit.targetValue);

  return (
    <article className="flex flex-col gap-4 rounded-[1.75rem] border border-slate-100 bg-slate-50/80 p-4 shadow-sm sm:flex-row sm:items-center sm:justify-between">
      <div className="flex min-w-0 flex-1 items-start gap-4">
        {!isEditingView && habit.habitType === "boolean" ? (
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

              <div className="mt-4 space-y-3 rounded-2xl border border-slate-200 bg-slate-50 p-4">
                <div>
                  <p className="text-sm font-medium text-slate-700">How often?</p>
                  <p className="mt-1 text-sm text-slate-500">
                    Update the schedule this streak should follow.
                  </p>
                </div>

                <div className="grid gap-3">
                  <button
                    type="button"
                    onClick={() => setDraftFrequencyType("daily")}
                    className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                      draftFrequencyType === "daily"
                        ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                        : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                    }`}
                  >
                    Every day
                  </button>

                  <div
                    className={`rounded-2xl border px-4 py-3 transition ${
                      draftFrequencyType === "weekly_count"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDraftFrequencyType("weekly_count")}
                      className="w-full text-left text-sm font-medium text-slate-700"
                    >
                      X times per week
                    </button>

                    {draftFrequencyType === "weekly_count" ? (
                      <div className="mt-3 flex items-center gap-3">
                        <input
                          type="number"
                          min="1"
                          max={MAX_WEEKLY_FREQUENCY_VALUE}
                          step="1"
                          value={draftFrequencyValue}
                          onChange={(event) =>
                            setDraftFrequencyValue(event.target.value)
                          }
                          className="min-h-11 w-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:ring-4 focus:ring-emerald-100"
                        />
                        <span className="text-sm text-slate-600">times per week</span>
                      </div>
                    ) : null}
                  </div>

                  <div
                    className={`rounded-2xl border px-4 py-3 transition ${
                      draftFrequencyType === "specific_days"
                        ? "border-emerald-300 bg-emerald-50"
                        : "border-slate-200 bg-white"
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => setDraftFrequencyType("specific_days")}
                      className="w-full text-left text-sm font-medium text-slate-700"
                    >
                      Specific days
                    </button>

                    {draftFrequencyType === "specific_days" ? (
                      <div className="mt-3 flex flex-wrap gap-2">
                        {getFrequencyDayOptions().map((day) => {
                          const selected = draftFrequencyDays.includes(day.value);

                          return (
                            <button
                              key={day.value}
                              type="button"
                              onClick={() => toggleFrequencyDay(day.value)}
                              className={`inline-flex min-h-10 items-center justify-center rounded-full border px-4 py-2 text-sm font-medium transition ${
                                selected
                                  ? "border-emerald-300 bg-emerald-100 text-emerald-700"
                                  : "border-slate-200 bg-white text-slate-600 hover:border-slate-300"
                              }`}
                            >
                              {day.label}
                            </button>
                          );
                        })}
                      </div>
                    ) : null}
                  </div>
                </div>
              </div>

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

              {habit.habitType === "boolean" ? (
                <div className="mt-2 flex flex-wrap gap-2 text-sm text-slate-600">
                  <span className="rounded-full bg-white px-3 py-1">
                    {habit.completedToday ? "Completed today" : "Not done yet"}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1">
                    {getStreakUnitLabel(habit.frequencyType, habit.streak)}
                  </span>
                  <span className="rounded-full bg-white px-3 py-1">
                    {formatHabitFrequency(
                      habit.frequencyType,
                      habit.frequencyValue,
                      habit.frequencyDays,
                    )}
                  </span>
                  {!habit.expectedToday ? (
                    <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                      Not scheduled today
                    </span>
                  ) : null}
                </div>
              ) : (
                <div className="mt-3 space-y-3">
                  <div className="flex flex-wrap items-center gap-2 text-sm text-slate-600">
                    <button
                      type="button"
                      onClick={handleStartValueEditing}
                      disabled={isTogglePending}
                      className="rounded-full bg-white px-3 py-1 font-medium text-slate-700 transition hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-60"
                    >
                      {formatQuantifiedProgress(
                        habit.currentValue,
                        habit.targetValue,
                        habit.unit,
                      )}
                    </button>
                    <span className="rounded-full bg-white px-3 py-1">
                      {habit.completedToday ? "Target reached" : "Working on it"}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {getStreakUnitLabel(habit.frequencyType, habit.streak)}
                    </span>
                    <span className="rounded-full bg-white px-3 py-1">
                      {formatHabitFrequency(
                        habit.frequencyType,
                        habit.frequencyValue,
                        habit.frequencyDays,
                      )}
                    </span>
                    {!habit.expectedToday ? (
                      <span className="rounded-full bg-slate-100 px-3 py-1 text-slate-500">
                        Not scheduled today
                      </span>
                    ) : null}
                  </div>

                  <div className="h-3 overflow-hidden rounded-full bg-white">
                    <div
                      className={`h-full rounded-full transition ${
                        habit.completedToday ? "bg-emerald-500" : "bg-sky-400"
                      }`}
                      style={{ width: `${progressPercent}%` }}
                    />
                  </div>

                  {isEditingValue ? (
                    <div className="rounded-2xl border border-slate-200 bg-white p-3">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
                        <input
                          ref={valueInputRef}
                          type="number"
                          min="0"
                          step="0.1"
                          value={draftValue}
                          onChange={(event) => setDraftValue(event.target.value)}
                          onKeyDown={(event) => {
                            if (event.key === "Enter") {
                              event.preventDefault();
                              handleSaveValue();
                            }

                            if (event.key === "Escape") {
                              event.preventDefault();
                              handleCancelValueEditing();
                            }
                          }}
                          className="min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                        />
                        <div className="flex gap-2">
                          <button
                            type="button"
                            onClick={handleSaveValue}
                            className="inline-flex min-h-10 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800"
                          >
                            Save
                          </button>
                          <button
                            type="button"
                            onClick={handleCancelValueEditing}
                            className="inline-flex min-h-10 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50"
                          >
                            Cancel
                          </button>
                        </div>
                      </div>

                      {valueErrorMessage ? (
                        <p className="mt-2 text-sm text-rose-600">{valueErrorMessage}</p>
                      ) : null}
                    </div>
                  ) : (
                    <div className="flex flex-wrap items-center gap-2">
                      <button
                        type="button"
                        onClick={() =>
                          handleCommitValue(Math.max((habit.currentValue ?? 0) - 1, 0))
                        }
                        disabled={isTogglePending}
                        aria-label={`Decrease ${habit.name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        –
                      </button>
                      <button
                        type="button"
                        onClick={handleStartValueEditing}
                        disabled={isTogglePending}
                        className="rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        Enter value
                      </button>
                      <button
                        type="button"
                        onClick={() => handleCommitValue((habit.currentValue ?? 0) + 1)}
                        disabled={isTogglePending}
                        aria-label={`Increase ${habit.name}`}
                        className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-lg font-semibold text-slate-700 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                      >
                        +
                      </button>
                    </div>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {!isEditingView && !isEditingValue ? <ArchiveButton habitId={habit.id} /> : null}
    </article>
  );
}
