"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { addHabit, createCategory } from "@/app/(protected)/actions";
import {
  DEFAULT_CATEGORY_COLOR,
  MAX_CATEGORY_NAME_LENGTH,
  type CategoryOption,
  validateCategoryColor,
  validateCategoryName,
} from "@/lib/categories";
import {
  getFrequencyDayOptions,
  MAX_WEEKLY_FREQUENCY_VALUE,
  MAX_HABIT_NAME_LENGTH,
  MAX_HABIT_UNIT_LENGTH,
  normalizeFrequencyDays,
  validateHabitFrequency,
  validateHabitUnit,
  validateTargetValue,
  type FrequencyType,
  type HabitType,
} from "@/lib/habits";

const NEW_CATEGORY_VALUE = "__new_category__";

type AddHabitFormProps = {
  categories: CategoryOption[];
};

function sortCategories(categories: CategoryOption[]) {
  return [...categories].sort((left, right) => left.name.localeCompare(right.name));
}

export function AddHabitForm({ categories }: AddHabitFormProps) {
  const router = useRouter();
  const [name, setName] = useState("");
  const [habitType, setHabitType] = useState<HabitType>("boolean");
  const [targetValue, setTargetValue] = useState("");
  const [unit, setUnit] = useState("");
  const [frequencyType, setFrequencyType] = useState<FrequencyType>("daily");
  const [frequencyValue, setFrequencyValue] = useState("3");
  const [frequencyDays, setFrequencyDays] = useState<number[]>([1, 2, 3, 4, 5]);
  const [selectedCategoryId, setSelectedCategoryId] = useState("");
  const [availableCategories, setAvailableCategories] = useState(
    sortCategories(categories),
  );
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isCategoryModalOpen, setIsCategoryModalOpen] = useState(false);
  const [categoryName, setCategoryName] = useState("");
  const [categoryColor, setCategoryColor] = useState(DEFAULT_CATEGORY_COLOR);
  const [categoryErrorMessage, setCategoryErrorMessage] = useState<string | null>(
    null,
  );
  const [isPending, startTransition] = useTransition();
  const [isCreatingCategory, startCategoryTransition] = useTransition();

  useEffect(() => {
    setAvailableCategories(sortCategories(categories));
  }, [categories]);

  useEffect(() => {
    if (
      selectedCategoryId &&
      !categories.some((category) => category.id === selectedCategoryId)
    ) {
      setSelectedCategoryId("");
    }
  }, [categories, selectedCategoryId]);

  function resetCategoryModal() {
    setCategoryName("");
    setCategoryColor(DEFAULT_CATEGORY_COLOR);
    setCategoryErrorMessage(null);
    setIsCategoryModalOpen(false);
  }

  function handleCategoryChange(event: React.ChangeEvent<HTMLSelectElement>) {
    const nextValue = event.target.value;

    if (nextValue === NEW_CATEGORY_VALUE) {
      setIsCategoryModalOpen(true);
      return;
    }

    setSelectedCategoryId(nextValue);
  }

  function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setErrorMessage(null);

    if (habitType === "quantified") {
      const parsedTargetValue = Number(targetValue);
      const targetError = validateTargetValue(parsedTargetValue, habitType);

      if (targetError) {
        setErrorMessage(targetError);
        return;
      }

      const unitError = validateHabitUnit(unit);

      if (unitError) {
        setErrorMessage(unitError);
        return;
      }
    }

    const parsedFrequencyValue =
      frequencyType === "weekly_count" ? Number(frequencyValue) : null;
    const frequencyError = validateHabitFrequency({
      frequencyType,
      frequencyValue: parsedFrequencyValue,
      frequencyDays,
    });

    if (frequencyError) {
      setErrorMessage(frequencyError);
      return;
    }

    startTransition(() => {
      void (async () => {
        const result = await addHabit({
          name,
          categoryId: selectedCategoryId || null,
          habitType,
          targetValue:
            habitType === "quantified" ? Number(targetValue || 0) : null,
          unit: habitType === "quantified" ? unit : null,
          frequencyType,
          frequencyValue:
            frequencyType === "weekly_count" ? parsedFrequencyValue : null,
          frequencyDays:
            frequencyType === "specific_days"
              ? normalizeFrequencyDays(frequencyDays)
              : null,
        });

        if (result.error) {
          setErrorMessage(result.error);
          return;
        }

        setName("");
        setHabitType("boolean");
        setTargetValue("");
        setUnit("");
        setFrequencyType("daily");
        setFrequencyValue("3");
        setFrequencyDays([1, 2, 3, 4, 5]);
        router.refresh();
      })();
    });
  }

  function toggleFrequencyDay(day: number) {
    setFrequencyDays((current) => {
      const next = current.includes(day)
        ? current.filter((value) => value !== day)
        : [...current, day];

      return normalizeFrequencyDays(next);
    });
  }

  function handleCreateCategory(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setCategoryErrorMessage(null);

    const nameError = validateCategoryName(categoryName);

    if (nameError) {
      setCategoryErrorMessage(nameError);
      return;
    }

    const colorError = validateCategoryColor(categoryColor);

    if (colorError) {
      setCategoryErrorMessage(colorError);
      return;
    }

    startCategoryTransition(() => {
      void (async () => {
        const result = await createCategory({
          name: categoryName,
          color: categoryColor,
        });

        if (result.error || !result.category) {
          setCategoryErrorMessage(
            result.error ?? "Could not create that category.",
          );
          return;
        }

        const newCategory = result.category;

        setAvailableCategories((current) =>
          sortCategories([...current, newCategory]),
        );
        setSelectedCategoryId(newCategory.id);
        resetCategoryModal();
        router.refresh();
      })();
    });
  }

  return (
    <>
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

        <div className="mt-5 space-y-3">
          <input
            type="text"
            value={name}
            onChange={(event) => setName(event.target.value)}
            placeholder="Drink water"
            maxLength={MAX_HABIT_NAME_LENGTH}
            className="min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
          />

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700">
              Habit type
            </label>
            <div className="grid grid-cols-2 gap-3">
              <button
                type="button"
                onClick={() => setHabitType("boolean")}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  habitType === "boolean"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                }`}
              >
                Boolean
              </button>
              <button
                type="button"
                onClick={() => setHabitType("quantified")}
                className={`rounded-2xl border px-4 py-3 text-sm font-medium transition ${
                  habitType === "quantified"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                }`}
              >
                Quantified
              </button>
            </div>
          </div>

          {habitType === "quantified" ? (
            <div className="grid gap-3 sm:grid-cols-2">
              <div>
                <label
                  htmlFor="habit-target-value"
                  className="text-sm font-medium text-slate-700"
                >
                  Target value
                </label>
                <input
                  id="habit-target-value"
                  type="number"
                  min="0"
                  step="0.1"
                  value={targetValue}
                  onChange={(event) => setTargetValue(event.target.value)}
                  placeholder="8"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="habit-unit"
                  className="text-sm font-medium text-slate-700"
                >
                  Unit
                </label>
                <input
                  id="habit-unit"
                  type="text"
                  value={unit}
                  onChange={(event) => setUnit(event.target.value)}
                  maxLength={MAX_HABIT_UNIT_LENGTH}
                  placeholder="glasses"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            <div>
              <label className="text-sm font-medium text-slate-700">
                How often?
              </label>
              <p className="mt-1 text-sm text-slate-500">
                Choose whether this habit should happen every day, a few times each week, or only on specific days.
              </p>
            </div>

            <div className="grid gap-3">
              <button
                type="button"
                onClick={() => setFrequencyType("daily")}
                className={`rounded-2xl border px-4 py-3 text-left text-sm font-medium transition ${
                  frequencyType === "daily"
                    ? "border-emerald-300 bg-emerald-50 text-emerald-700"
                    : "border-slate-200 bg-slate-50 text-slate-600 hover:border-slate-300"
                }`}
              >
                Every day
              </button>

              <div
                className={`rounded-2xl border px-4 py-3 transition ${
                  frequencyType === "weekly_count"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFrequencyType("weekly_count")}
                  className="flex w-full items-center justify-between gap-3 text-left text-sm font-medium text-slate-700"
                >
                  <span>X times per week</span>
                  <span className="text-xs uppercase tracking-[0.22em] text-slate-400">
                    Flexible
                  </span>
                </button>

                {frequencyType === "weekly_count" ? (
                  <div className="mt-3 flex items-center gap-3">
                    <input
                      type="number"
                      min="1"
                      max={MAX_WEEKLY_FREQUENCY_VALUE}
                      step="1"
                      value={frequencyValue}
                      onChange={(event) => setFrequencyValue(event.target.value)}
                      className="min-h-11 w-28 rounded-2xl border border-slate-200 bg-white px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                    />
                    <span className="text-sm text-slate-600">times per week</span>
                  </div>
                ) : null}
              </div>

              <div
                className={`rounded-2xl border px-4 py-3 transition ${
                  frequencyType === "specific_days"
                    ? "border-emerald-300 bg-emerald-50"
                    : "border-slate-200 bg-slate-50"
                }`}
              >
                <button
                  type="button"
                  onClick={() => setFrequencyType("specific_days")}
                  className="w-full text-left text-sm font-medium text-slate-700"
                >
                  Specific days
                </button>

                {frequencyType === "specific_days" ? (
                  <div className="mt-3 flex flex-wrap gap-2">
                    {getFrequencyDayOptions().map((day) => {
                      const selected = frequencyDays.includes(day.value);

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

          <div className="flex flex-col gap-3">
            <label className="text-sm font-medium text-slate-700" htmlFor="habit-category">
              Category
            </label>
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center">
              <select
                id="habit-category"
                value={selectedCategoryId}
                onChange={handleCategoryChange}
                className="min-h-12 flex-1 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
              >
                <option value="">Uncategorized</option>
                {availableCategories.map((category) => (
                  <option key={category.id} value={category.id}>
                    {category.name}
                  </option>
                ))}
                <option value={NEW_CATEGORY_VALUE}>+ New category</option>
              </select>

              <button
                type="button"
                onClick={() => setIsCategoryModalOpen(true)}
                className="inline-flex min-h-12 items-center justify-center rounded-2xl border border-slate-200 bg-white px-4 py-3 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
              >
                + New category
              </button>
            </div>
          </div>

          <button
            type="submit"
            disabled={isPending}
            className="inline-flex min-h-12 w-full items-center justify-center rounded-2xl bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
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
            {habitType === "quantified"
              ? " Quantified habits count as complete once they reach the target."
              : ""}
          </p>
        )}
      </form>

      {isCategoryModalOpen ? (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/35 px-4">
          <div className="w-full max-w-md rounded-[2rem] border border-white/70 bg-white p-6 shadow-xl">
            <div className="flex items-start justify-between gap-4">
              <div>
                <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
                  New Category
                </p>
                <h3 className="mt-2 text-2xl font-semibold text-slate-900">
                  Add a category for related habits
                </h3>
              </div>

              <button
                type="button"
                onClick={resetCategoryModal}
                className="inline-flex h-10 w-10 items-center justify-center rounded-full border border-slate-200 text-slate-500 transition hover:border-slate-300 hover:text-slate-700"
                aria-label="Close category dialog"
              >
                <svg
                  viewBox="0 0 20 20"
                  fill="none"
                  stroke="currentColor"
                  strokeWidth="1.8"
                  className="h-4 w-4"
                  aria-hidden="true"
                >
                  <path d="m5 5 10 10M15 5 5 15" strokeLinecap="round" />
                </svg>
              </button>
            </div>

            <form onSubmit={handleCreateCategory} className="mt-5 space-y-4">
              <div>
                <label
                  htmlFor="new-category-name"
                  className="text-sm font-medium text-slate-700"
                >
                  Name
                </label>
                <input
                  id="new-category-name"
                  type="text"
                  value={categoryName}
                  onChange={(event) => setCategoryName(event.target.value)}
                  maxLength={MAX_CATEGORY_NAME_LENGTH}
                  placeholder="Fitness"
                  className="mt-2 min-h-12 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
                />
              </div>

              <div>
                <label
                  htmlFor="new-category-color"
                  className="text-sm font-medium text-slate-700"
                >
                  Color
                </label>
                <div className="mt-2 flex items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3">
                  <input
                    id="new-category-color"
                    type="color"
                    value={categoryColor}
                    onChange={(event) => setCategoryColor(event.target.value.toUpperCase())}
                    className="h-10 w-12 rounded-lg border-0 bg-transparent p-0"
                  />
                  <span className="rounded-full bg-white px-3 py-1 text-sm font-medium text-slate-600">
                    {categoryColor.toUpperCase()}
                  </span>
                </div>
              </div>

              {categoryErrorMessage ? (
                <p className="rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
                  {categoryErrorMessage}
                </p>
              ) : (
                <p className="text-sm text-slate-500">
                  Pick something short and visual so grouped habits stay easy to scan.
                </p>
              )}

              <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
                <button
                  type="button"
                  onClick={resetCategoryModal}
                  disabled={isCreatingCategory}
                  className="inline-flex min-h-11 items-center justify-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isCreatingCategory}
                  className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                >
                  {isCreatingCategory ? "Creating..." : "Create category"}
                </button>
              </div>
            </form>
          </div>
        </div>
      ) : null}
    </>
  );
}
