import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { ArchivedHabitsList } from "@/components/settings/archived-habits-list";
import { isMissingHabitsTableError, type HabitRow } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

function formatCreatedLabel(createdAt: string) {
  return `Created ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(new Date(createdAt))}`;
}

export default async function ArchivedHabitsPage() {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data, error } = await supabase
    .from("habits")
    .select("id, name, created_at")
    .eq("user_id", user.id)
    .eq("archived", true)
    .order("created_at", { ascending: false });

  if (error) {
    if (isMissingHabitsTableError(error)) {
      return (
        <section className="rounded-[2rem] border border-amber-200 bg-white/90 p-6 shadow-sm sm:p-8">
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-amber-700">
            Archived habits unavailable
          </p>
          <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
            The settings page needs the Supabase habit tables first.
          </h2>
          <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
            Your sign-in is working, but this page can&apos;t load archived habits
            until the database migration has been run.
          </p>
        </section>
      );
    }

    throw new Error("Could not load archived habits.");
  }

  const archivedHabits = ((data ?? []) as HabitRow[]).map((habit) => ({
    id: habit.id,
    name: habit.name,
    createdLabel: formatCreatedLabel(habit.created_at),
  }));

  return (
    <div className="space-y-6">
      <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          Archived Habits
        </p>
        <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Bring retired habits back, or clear them out permanently.
        </h2>
        <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600 sm:text-base">
          Archive keeps your daily board tidy without erasing history. From here,
          you can restore a habit or delete it along with all of its completion
          records.
        </p>
      </section>

      <ArchivedHabitsList habits={archivedHabits} />
    </div>
  );
}
