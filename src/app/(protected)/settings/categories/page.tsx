import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { CategoryList } from "@/components/settings/category-list";
import { type CategoryRow } from "@/lib/categories";
import { isMissingHabitsTableError } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

const migrationPath =
  "/Users/rajatgulati/Documents/Codex/2026-04-22-create-a-new-next-js-14/habit-tracker/supabase/migrations/202604230001_add_categories.sql";

export default async function CategoriesSettingsPage() {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("categories")
    .select("id, name, color, created_at")
    .eq("user_id", user.id)
    .order("name", { ascending: true });

  if (error) {
    if (isMissingHabitsTableError(error)) {
      return (
        <section className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Categories unavailable
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            The categories settings page needs the latest migration first.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Run the new SQL migration in Supabase, then refresh this page to
            manage habit categories.
          </p>
          <p className="mt-4 break-all text-sm font-medium text-slate-900">
            {migrationPath}
          </p>
        </section>
      );
    }

    throw new Error("Could not load categories.");
  }

  const categories = ((data ?? []) as CategoryRow[]).map((category) => ({
    id: category.id,
    name: category.name,
    color: category.color,
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          Categories
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Rename, recolor, or retire the buckets that organize your habits.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          Categories help split the daily board into clearer sections. When you
          delete one here, its habits stay intact and simply move to
          uncategorized.
        </p>
      </section>

      <CategoryList categories={categories} />
    </div>
  );
}
