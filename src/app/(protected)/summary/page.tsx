import { unstable_noStore as noStore } from "next/cache";
import Link from "next/link";
import { redirect } from "next/navigation";
import {
  calculateCompletionRate,
  getTodayIso,
  getTrailingDays,
  isMissingHabitsTableError,
  type HabitCompletionRow,
  type HabitRow,
} from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

type WeeklyHabitItem = {
  id: string;
  name: string;
  completionRate: number;
  completedDays: number;
  days: Array<{
    iso: string;
    dayLabel: string;
    shortLabel: string;
    dateLabel: string;
    completed: boolean;
  }>;
};

function buildWeeklyHabitItems(
  habits: HabitRow[],
  completions: HabitCompletionRow[],
  todayIso: string,
) {
  const trailingDays = getTrailingDays(todayIso, 7);
  const completionsByHabit = new Map<string, Set<string>>();

  completions.forEach((completion) => {
    const completionSet =
      completionsByHabit.get(completion.habit_id) ?? new Set<string>();
    completionSet.add(completion.completed_on);
    completionsByHabit.set(completion.habit_id, completionSet);
  });

  return habits.map<WeeklyHabitItem>((habit) => {
    const completionSet = completionsByHabit.get(habit.id) ?? new Set<string>();
    const days = trailingDays.map((day) => ({
      ...day,
      completed: completionSet.has(day.iso),
    }));
    const completedDays = days.filter((day) => day.completed).length;

    return {
      id: habit.id,
      name: habit.name,
      completionRate: calculateCompletionRate(completedDays, days.length),
      completedDays,
      days,
    };
  });
}

export default async function SummaryPage() {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const todayIso = getTodayIso();
  const trailingDays = getTrailingDays(todayIso, 7);
  const weekStartIso = trailingDays[0]?.iso ?? todayIso;

  const { data: habitsData, error: habitsError } = await supabase
    .from("habits")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .eq("archived", false)
    .order("created_at", { ascending: true });

  if (habitsError) {
    if (isMissingHabitsTableError(habitsError)) {
      return (
        <section className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Summary unavailable
          </p>
          <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            The weekly view needs the habit tables to exist in Supabase first.
          </h1>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Your sign-in is working, but the database tables that store habits
            and completions still need to be created. Once that migration has
            been run, this page will start showing your last 7 days.
          </p>
        </section>
      );
    }

    throw new Error("Could not load weekly summary.");
  }

  const habits = (habitsData ?? []) as HabitRow[];
  const habitIds = habits.map((habit) => habit.id);

  let completions: HabitCompletionRow[] = [];

  if (habitIds.length > 0) {
    const { data: completionsData, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_on")
      .eq("user_id", user.id)
      .in("habit_id", habitIds)
      .gte("completed_on", weekStartIso)
      .lte("completed_on", todayIso);

    if (completionsError) {
      throw new Error("Could not load weekly completions.");
    }

    completions = (completionsData ?? []) as HabitCompletionRow[];
  }

  const weeklyHabits = buildWeeklyHabitItems(habits, completions, todayIso);
  const totalCompletedCells = weeklyHabits.reduce(
    (sum, habit) => sum + habit.completedDays,
    0,
  );
  const totalPossibleCells = weeklyHabits.length * 7;
  const overallRate = calculateCompletionRate(totalCompletedCells, totalPossibleCells);

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          Weekly Summary
        </p>
        <div className="mt-3 flex flex-col gap-4 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <h1 className="text-3xl font-semibold tracking-tight text-slate-900 sm:text-5xl">
              A 7-day view of what stuck and what slipped.
            </h1>
            <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
              Each row shows the last week for one active habit, including today.
              Filled squares mean you showed up that day.
            </p>
          </div>

          <div className="rounded-[1.5rem] border border-emerald-100 bg-emerald-50/85 p-5 shadow-sm">
            <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
              Overall weekly rate
            </p>
            <p className="mt-3 text-3xl font-semibold text-slate-900">
              {overallRate}%
            </p>
          </div>
        </div>
      </section>

      {weeklyHabits.length === 0 ? (
        <section className="rounded-[2rem] border border-white/70 bg-white/85 p-8 text-center shadow-sm">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-slate-500">
            No active habits yet
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Your weekly overview will appear here once you add your first habit.
          </h2>
          <p className="mt-4 text-sm leading-7 text-slate-600">
            Start on the daily board, add a habit, and this summary will begin
            filling in automatically.
          </p>
          <Link
            href="/"
            className="mt-6 inline-flex items-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700"
          >
            Go to daily board
          </Link>
        </section>
      ) : (
        <section className="space-y-4">
          {weeklyHabits.map((habit) => (
            <article
              key={habit.id}
              className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm sm:p-6"
            >
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <p className="text-lg font-semibold text-slate-900">{habit.name}</p>
                  <p className="mt-1 text-sm text-slate-500">
                    {habit.completedDays} of 7 days completed this week
                  </p>
                </div>

                <div className="rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white">
                  {habit.completionRate}%
                </div>
              </div>

              <div className="mt-5 overflow-x-auto">
                <div className="grid min-w-[22rem] grid-cols-7 gap-3">
                  {habit.days.map((day) => (
                    <div key={`${habit.id}-${day.iso}`} className="text-center">
                      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-400">
                        {day.shortLabel}
                      </p>
                      <div
                        className={`mt-2 aspect-square rounded-2xl border transition ${
                          day.completed
                            ? "border-emerald-400 bg-emerald-500 shadow-[inset_0_1px_0_rgba(255,255,255,0.35)]"
                            : "border-slate-200 bg-slate-100"
                        }`}
                        aria-label={`${habit.name} ${day.dayLabel} ${day.dateLabel}: ${
                          day.completed ? "completed" : "not completed"
                        }`}
                        title={`${day.dayLabel} ${day.dateLabel}`}
                      />
                      <p className="mt-2 text-xs text-slate-500">{day.dateLabel}</p>
                    </div>
                  ))}
                </div>
              </div>
            </article>
          ))}
        </section>
      )}
    </div>
  );
}
