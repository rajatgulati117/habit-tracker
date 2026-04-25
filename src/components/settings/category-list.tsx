"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import {
  deleteCategory,
  updateCategory,
} from "@/app/(protected)/actions";
import {
  type CategoryOption,
  validateCategoryColor,
  validateCategoryName,
} from "@/lib/categories";

type CategoryListProps = {
  categories: CategoryOption[];
};

type DraftState = Record<
  string,
  {
    name: string;
    color: string;
  }
>;

export function CategoryList({ categories }: CategoryListProps) {
  const router = useRouter();
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [rowErrors, setRowErrors] = useState<Record<string, string | null>>({});
  const [pendingIds, setPendingIds] = useState<Record<string, boolean>>({});
  const [drafts, setDrafts] = useState<DraftState>(() =>
    Object.fromEntries(
      categories.map((category) => [
        category.id,
        { name: category.name, color: category.color },
      ]),
    ),
  );
  const [, startTransition] = useTransition();

  useEffect(() => {
    setDrafts(
      Object.fromEntries(
        categories.map((category) => [
          category.id,
          { name: category.name, color: category.color },
        ]),
      ),
    );
  }, [categories]);

  function setPending(categoryId: string, isPending: boolean) {
    setPendingIds((current) => {
      const next = { ...current };

      if (isPending) {
        next[categoryId] = true;
      } else {
        delete next[categoryId];
      }

      return next;
    });
  }

  function setDraftValue(
    categoryId: string,
    field: "name" | "color",
    value: string,
  ) {
    setDrafts((current) => ({
      ...current,
      [categoryId]: {
        ...(current[categoryId] ?? { name: "", color: "#22C55E" }),
        [field]: value,
      },
    }));
  }

  function refreshPage() {
    startTransition(() => {
      router.refresh();
    });
  }

  async function handleSave(category: CategoryOption) {
    const draft = drafts[category.id] ?? {
      name: category.name,
      color: category.color,
    };

    setNotice(null);
    setErrorMessage(null);

    const nameError = validateCategoryName(draft.name);

    if (nameError) {
      setRowErrors((current) => ({ ...current, [category.id]: nameError }));
      return;
    }

    const colorError = validateCategoryColor(draft.color);

    if (colorError) {
      setRowErrors((current) => ({ ...current, [category.id]: colorError }));
      return;
    }

    setRowErrors((current) => ({ ...current, [category.id]: null }));
    setPending(category.id, true);

    const result = await updateCategory({
      categoryId: category.id,
      name: draft.name,
      color: draft.color,
    });

    setPending(category.id, false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setNotice("Category saved");
    refreshPage();
  }

  async function handleDelete(category: CategoryOption) {
    const confirmed = window.confirm(
      `Delete ${category.name}? Habits using it will become uncategorized.`,
    );

    if (!confirmed) {
      return;
    }

    setNotice(null);
    setErrorMessage(null);
    setPending(category.id, true);

    const result = await deleteCategory({
      categoryId: category.id,
    });

    setPending(category.id, false);

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setNotice("Category deleted");
    refreshPage();
  }

  if (categories.length === 0) {
    return (
      <section className="rounded-[2rem] border border-dashed border-slate-200 bg-white/85 p-8 text-center shadow-sm">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
          No categories yet
        </p>
        <h2 className="mt-3 text-2xl font-semibold text-slate-900">
          Your categories will show up here once you create one.
        </h2>
        <p className="mt-3 text-sm leading-6 text-slate-600">
          You can add categories from the habit creation form and then manage
          their names and colors here.
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

      {categories.map((category) => {
        const draft = drafts[category.id] ?? {
          name: category.name,
          color: category.color,
        };
        const isPending = Boolean(pendingIds[category.id]);

        return (
          <article
            key={category.id}
            className="rounded-[1.75rem] border border-slate-100 bg-white/85 p-5 shadow-sm"
          >
            <div className="flex flex-col gap-5">
              <div className="flex items-center gap-3">
                <span
                  className="inline-flex h-4 w-4 rounded-full border border-white shadow-sm"
                  style={{ backgroundColor: draft.color }}
                  aria-hidden="true"
                />
                <p className="text-lg font-semibold text-slate-900">
                  {category.name}
                </p>
              </div>

              <div className="grid gap-4 lg:grid-cols-[1fr_auto_auto]">
                <div>
                  <label
                    htmlFor={`category-name-${category.id}`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Name
                  </label>
                  <input
                    id={`category-name-${category.id}`}
                    type="text"
                    value={draft.name}
                    onChange={(event) =>
                      setDraftValue(category.id, "name", event.target.value)
                    }
                    disabled={isPending}
                    className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
                  />
                </div>

                <div>
                  <label
                    htmlFor={`category-color-${category.id}`}
                    className="text-sm font-medium text-slate-700"
                  >
                    Color
                  </label>
                  <div className="mt-2 flex min-h-11 items-center gap-3 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-2">
                    <input
                      id={`category-color-${category.id}`}
                      type="color"
                      value={draft.color}
                      onChange={(event) =>
                        setDraftValue(
                          category.id,
                          "color",
                          event.target.value.toUpperCase(),
                        )
                      }
                      disabled={isPending}
                      className="h-9 w-12 rounded-lg border-0 bg-transparent p-0"
                    />
                    <span className="text-sm font-medium text-slate-600">
                      {draft.color}
                    </span>
                  </div>
                </div>

                <div className="flex flex-col gap-2 self-end sm:min-w-[11rem]">
                  <button
                    type="button"
                    onClick={() => void handleSave(category)}
                    disabled={isPending}
                    className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
                  >
                    {isPending ? "Saving..." : "Save changes"}
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleDelete(category)}
                    disabled={isPending}
                    className="inline-flex min-h-11 items-center justify-center rounded-full border border-rose-200 bg-white px-4 py-2 text-sm font-medium text-rose-700 transition hover:bg-rose-50 disabled:cursor-not-allowed disabled:opacity-60"
                  >
                    Delete
                  </button>
                </div>
              </div>

              {rowErrors[category.id] ? (
                <p className="text-sm text-rose-600">{rowErrors[category.id]}</p>
              ) : (
                <p className="text-sm text-slate-500">
                  Deleting a category keeps the habits, but they become uncategorized.
                </p>
              )}
            </div>
          </article>
        );
      })}
    </section>
  );
}
