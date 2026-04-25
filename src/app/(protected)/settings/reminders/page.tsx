import { unstable_noStore as noStore } from "next/cache";
import { redirect } from "next/navigation";
import { ReminderSettingsForm } from "@/components/settings/reminder-settings-form";
import { createClient } from "@/lib/supabase/server";

export default async function ReminderSettingsPage() {
  noStore();
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    redirect("/login");
  }

  const { data } = await supabase
    .from("user_preferences")
    .select(
      "user_id, reminder_enabled, reminder_time, timezone, last_reminder_sent_at",
    )
    .eq("user_id", user.id)
    .maybeSingle();

  return (
    <ReminderSettingsForm
      initialReminderEnabled={data?.reminder_enabled ?? false}
      initialReminderTime={data?.reminder_time ?? "20:00:00"}
      initialTimezone={data?.timezone ?? ""}
    />
  );
}
