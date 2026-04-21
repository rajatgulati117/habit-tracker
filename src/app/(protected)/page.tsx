import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { AddHabitForm } from "@/components/habits/add-habit-form";
import { HabitList } from "@/components/habits/habit-list";
import {
  calculateCurrentStreak,
  formatTodayLabel,
  getTodayIso,
  isMissingHabitsTableError,
  type HabitCompletionRow,
  type HabitListItem,
  type HabitRow,
} from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

function buildHabitItems(
  habits: HabitRow[],
  completions: HabitCompletionRow[],
  todayIso: string,
) {
  const completionsByHabit = new Map<string, string[]>();

  completions.forEach((completion) => {
    const list = completionsByHabit.get(completion.habit_id) ?? [];
    list.push(completion.completed_on);
    completionsByHabit.set(completion.habit_id, list);
  });

  return habits.map<HabitListItem>((habit) => {
    const completionDates = completionsByHabit.get(habit.id) ?? [];

    return {
      id: habit.id,
      name: habit.name,
      createdAt: habit.created_at,
      completedToday: completionDates.includes(todayIso),
      streak: calculateCurrentStreak(completionDates, todayIso),
    };
  });
}

export default async function Home() {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const todayIso = getTodayIso();

  const { data: habitsData, error: habitsError } = await supabase
    .from("habits")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (habitsError) {
    if (isMissingHabitsTableError(habitsError)) {
      return (
        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <section className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm sm:p-8">
            <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
              One setup step left
            </p>
            <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
              Your app can sign in, but the habit tables haven&apos;t been created
              in Supabase yet.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Think of this like the app having a login system, but no shelves in
              the storage room yet. When the app tried to fetch your habits after
              sign-in, Supabase said the <code>habits</code> table does not exist,
              so the page failed.
            </p>
            <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50 p-5">
              <p className="text-sm font-semibold text-slate-900">
                What to do now
              </p>
              <ol className="mt-3 list-decimal space-y-2 pl-5 text-sm text-slate-600">
                <li>Open the Supabase SQL Editor for your project.</li>
                <li>
                  Paste the SQL from the migration file shown in this workspace.
                </li>
                <li>Run it once.</li>
                <li>Refresh this page.</li>
              </ol>
            </div>
          </section>

          <aside className="space-y-6">
            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
                SQL File
              </p>
              <p className="mt-3 text-sm leading-6 text-slate-600">
                Use:
              </p>
              <p className="mt-2 break-all text-sm font-medium text-slate-900">
                /Users/rajatgulati/Documents/Codex/2026-04-22-create-a-new-next-js-14/habit-tracker/supabase/migrations/202604220001_create_habits.sql
              </p>
            </div>

            <div className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm">
              <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
                Signed in
              </p>
              <p className="mt-3 break-all text-sm font-medium text-slate-700">
                {user.email}
              </p>
            </div>
          </aside>
        </div>
      );
    }

    throw new Error("Could not load habits.");
  }

  const habits = (habitsData ?? []) as HabitRow[];
  const habitIds = habits.map((habit) => habit.id);

  let completions: HabitCompletionRow[] = [];

  if (habitIds.length > 0) {
    const { data: completionsData, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_on")
      .eq("user_id", user.id)
      .in("habit_id", habitIds);

    if (completionsError) {
      throw new Error("Could not load completions.");
    }

    completions = (completionsData ?? []) as HabitCompletionRow[];
  }

  const habitItems = buildHabitItems(habits, completions, todayIso);
  const completedTodayCount = habitItems.filter((habit) => habit.completedToday)
    .length;
  const longestCurrentStreak = habitItems.reduce(
    (longest, habit) => Math.max(longest, habit.streak),
    0,
  );

  return (
    <div className="grid gap-6 xl:grid-cols-[1.35fr_0.65fr]">
      <section className="space-y-6">
        <div className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
            Daily Board
          </p>
          <h1 className="mt-3 max-w-3xl text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
            Keep today simple, visible, and hard to skip.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Add habits, mark today&apos;s completion, and let the streak counter
            show whether your rhythm is building or slipping.
          </p>
        </div>

        <HabitList habits={habitItems} todayLabel={formatTodayLabel()} />
      </section>

      <aside className="space-y-6">
        <div className="grid gap-4 sm:grid-cols-3 xl:grid-cols-1">
          <div className="rounded-[2rem] border border-emerald-100 bg-emerald-50/85 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Active habits
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {habitItems.length}
            </p>
          </div>

          <div className="rounded-[2rem] border border-sky-100 bg-sky-50/85 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-sky-700">
              Done today
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {completedTodayCount}
            </p>
          </div>

          <div className="rounded-[2rem] border border-amber-100 bg-amber-50/85 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-amber-700">
              Best streak
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {longestCurrentStreak}
            </p>
          </div>
        </div>

        <AddHabitForm />

        <div className="rounded-[2rem] border border-white/70 bg-white/80 p-5 shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            Signed in
          </p>
          <p className="mt-3 break-all text-sm font-medium text-slate-700">
            {user.email}
          </p>
        </div>
      </aside>
    </div>
  );
}
