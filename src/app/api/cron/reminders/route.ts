import { NextResponse } from "next/server";
import { Resend } from "resend";
import { type User } from "@supabase/supabase-js";
import { type HabitCompletionRow, type HabitRow } from "@/lib/habits";
import {
  buildReminderEmailHtml,
  createUnsubscribeToken,
  getAppUrl,
  getIncompleteHabitsForDate,
  getLocalIsoDate,
  isReminderDue,
  type UserPreferenceRow,
  wasReminderSentToday,
} from "@/lib/reminders";
import { createAdminClient } from "@/lib/supabase/admin";

export const dynamic = "force-dynamic";
export const runtime = "nodejs";

function getReminderName(user: User) {
  const metadata = user.user_metadata ?? {};

  return (
    metadata.full_name ||
    metadata.name ||
    metadata.first_name ||
    user.email?.split("@")[0] ||
    "there"
  );
}

function isAuthorized(request: Request) {
  const secret = process.env.CRON_SECRET;

  if (!secret) {
    throw new Error("Missing CRON_SECRET.");
  }

  return request.headers.get("authorization") === `Bearer ${secret}`;
}

export async function GET(request: Request) {
  try {
    if (!isAuthorized(request)) {
      return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
    }

    const resendApiKey = process.env.RESEND_API_KEY;

    if (!resendApiKey) {
      return NextResponse.json(
        { error: "Missing RESEND_API_KEY." },
        { status: 500 },
      );
    }

    const supabase = createAdminClient();
    const resend = new Resend(resendApiKey);
    const now = new Date();
    const appUrl = getAppUrl();
    const fromEmail = process.env.RESEND_FROM_EMAIL ?? "onboarding@resend.dev";

    const { data: preferenceRows, error: preferenceError } = await supabase
      .from("user_preferences")
      .select(
        "user_id, reminder_enabled, reminder_time, timezone, last_reminder_sent_at",
      )
      .eq("reminder_enabled", true);

    if (preferenceError) {
      console.error("[reminders] preferences_query_failed", preferenceError);
      return NextResponse.json(
        { error: "Could not load reminder preferences." },
        { status: 500 },
      );
    }

    const preferences = (preferenceRows ?? []) as UserPreferenceRow[];
    let sent = 0;
    let skipped = 0;
    let failed = 0;

    for (const preference of preferences) {
      try {
        if (
          !isReminderDue(preference.reminder_time, preference.timezone, now) ||
          wasReminderSentToday(
            preference.last_reminder_sent_at,
            preference.timezone,
            now,
          )
        ) {
          skipped += 1;
          continue;
        }

        const { data: latestPreference, error: latestPreferenceError } =
          await supabase
            .from("user_preferences")
            .select(
              "user_id, reminder_enabled, reminder_time, timezone, last_reminder_sent_at",
            )
            .eq("user_id", preference.user_id)
            .maybeSingle();

        if (latestPreferenceError) {
          throw latestPreferenceError;
        }

        if (!latestPreference?.reminder_enabled) {
          skipped += 1;
          continue;
        }

        if (
          !isReminderDue(
            latestPreference.reminder_time,
            latestPreference.timezone,
            now,
          ) ||
          wasReminderSentToday(
            latestPreference.last_reminder_sent_at,
            latestPreference.timezone,
            now,
          )
        ) {
          skipped += 1;
          continue;
        }

        let reservationQuery = supabase
          .from("user_preferences")
          .update({ last_reminder_sent_at: now.toISOString() })
          .eq("user_id", preference.user_id);

        if (latestPreference.last_reminder_sent_at) {
          reservationQuery = reservationQuery.eq(
            "last_reminder_sent_at",
            latestPreference.last_reminder_sent_at,
          );
        } else {
          reservationQuery = reservationQuery.is("last_reminder_sent_at", null);
        }

        const { data: reservationRow, error: reservationError } =
          await reservationQuery.select("user_id").maybeSingle();

        if (reservationError) {
          throw reservationError;
        }

        if (!reservationRow) {
          skipped += 1;
          continue;
        }

        const localTodayIso = getLocalIsoDate(now, latestPreference.timezone);
        const [{ data: habitsData, error: habitsError }, userResult] =
          await Promise.all([
            supabase
              .from("habits")
              .select(
                "id, name, created_at, habit_type, target_value, unit, frequency_type, frequency_value, frequency_days",
              )
              .eq("user_id", preference.user_id)
              .eq("archived", false)
              .order("created_at", { ascending: true }),
            supabase.auth.admin.getUserById(preference.user_id),
          ]);

        if (habitsError) {
          throw habitsError;
        }

        const user = userResult.data.user;

        if (!user?.email) {
          skipped += 1;
          continue;
        }

        const habits = (habitsData ?? []) as HabitRow[];

        if (habits.length === 0) {
          skipped += 1;
          continue;
        }

        const habitIds = habits.map((habit) => habit.id);
        const { data: completionRows, error: completionError } = await supabase
          .from("habit_completions")
          .select("habit_id, completed_on, value")
          .eq("user_id", preference.user_id)
          .in("habit_id", habitIds)
          .eq("completed_on", localTodayIso);

        if (completionError) {
          throw completionError;
        }

        const completions = (completionRows ?? []) as HabitCompletionRow[];
        const incompleteHabits = getIncompleteHabitsForDate({
          habits,
          completions,
          isoDate: localTodayIso,
        });

        if (incompleteHabits.length === 0) {
          skipped += 1;
          continue;
        }

        const expiresAt = new Date(now.getTime() + 1000 * 60 * 60 * 24 * 30).toISOString();
        const token = createUnsubscribeToken(preference.user_id, expiresAt);
        const unsubscribeUrl = new URL("/api/reminders/unsubscribe", appUrl);
        unsubscribeUrl.searchParams.set("user", preference.user_id);
        unsubscribeUrl.searchParams.set("exp", expiresAt);
        unsubscribeUrl.searchParams.set("token", token);

        const html = buildReminderEmailHtml({
          name: getReminderName(user),
          email: user.email,
          habits: incompleteHabits,
          unsubscribeUrl: unsubscribeUrl.toString(),
          appUrl,
        });

        const sendResult = await resend.emails.send({
          from: fromEmail,
          to: user.email,
          subject: "Your habits still have a few open check-ins today",
          html,
        });

        if (sendResult.error) {
          throw new Error(sendResult.error.message);
        }

        console.info(
          `[reminders] provider=resend user=${preference.user_id} timezone=${preference.timezone} date=${localTodayIso} habits=${incompleteHabits.length}`,
        );
        sent += 1;
      } catch (error) {
        await supabase
          .from("user_preferences")
          .update({
            last_reminder_sent_at: preference.last_reminder_sent_at,
          })
          .eq("user_id", preference.user_id);

        failed += 1;
        console.error("[reminders] send_failed", {
          userId: preference.user_id,
          message: error instanceof Error ? error.message : String(error),
        });
      }
    }

    return NextResponse.json({
      ok: true,
      processed: preferences.length,
      sent,
      skipped,
      failed,
    });
  } catch (error) {
    console.error("[reminders] cron_failed", {
      message: error instanceof Error ? error.message : String(error),
    });

    return NextResponse.json(
      { error: "Reminder cron failed." },
      { status: 500 },
    );
  }
}
