"use client";

import { useEffect, useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { saveReminderPreferences } from "@/app/(protected)/actions";
import { formatReminderTimeInput } from "@/lib/reminder-preferences";

type ReminderSettingsFormProps = {
  initialReminderEnabled: boolean;
  initialReminderTime: string;
  initialTimezone: string;
};

const DEFAULT_TIMEZONE = "UTC";

function getSupportedTimeZones() {
  if (typeof Intl.supportedValuesOf === "function") {
    return Intl.supportedValuesOf("timeZone");
  }

  return [Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE];
}

export function ReminderSettingsForm({
  initialReminderEnabled,
  initialReminderTime,
  initialTimezone,
}: ReminderSettingsFormProps) {
  const router = useRouter();
  const [reminderEnabled, setReminderEnabled] = useState(initialReminderEnabled);
  const [reminderTime, setReminderTime] = useState(
    formatReminderTimeInput(initialReminderTime),
  );
  const [timezone, setTimezone] = useState(initialTimezone || DEFAULT_TIMEZONE);
  const [timezones, setTimezones] = useState<string[]>([initialTimezone || DEFAULT_TIMEZONE]);
  const [notice, setNotice] = useState<string | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    const detectedTimeZone =
      Intl.DateTimeFormat().resolvedOptions().timeZone || DEFAULT_TIMEZONE;
    const supported = Array.from(
      new Set([detectedTimeZone, initialTimezone || DEFAULT_TIMEZONE, ...getSupportedTimeZones()]),
    ).sort((left, right) => left.localeCompare(right));

    setTimezones(supported);

    if (!initialTimezone) {
      setTimezone(detectedTimeZone);
    }
  }, [initialTimezone]);

  async function handleSubmit(formData: FormData) {
    setNotice(null);
    setErrorMessage(null);

    const result = await saveReminderPreferences({
      reminderEnabled: formData.get("reminder_enabled") === "on",
      reminderTime: String(formData.get("reminder_time") ?? ""),
      timezone: String(formData.get("timezone") ?? ""),
    });

    if (result.error) {
      setErrorMessage(result.error);
      return;
    }

    setNotice("Reminder preferences saved");
    startTransition(() => {
      router.refresh();
    });
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
        Daily reminders
      </p>
      <h2 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
        Choose when the app should nudge you by email.
      </h2>
      <p className="mt-4 max-w-2xl text-sm leading-7 text-slate-600">
        We&apos;ll only send one reminder per day, and only if you still have
        habits left to complete.
      </p>

      <form action={handleSubmit} className="mt-8 space-y-6">
        <label className="flex items-start justify-between gap-4 rounded-[1.5rem] border border-slate-100 bg-slate-50/80 p-5">
          <div>
            <p className="text-sm font-semibold text-slate-900">
              Email me a reminder
            </p>
            <p className="mt-1 text-sm leading-6 text-slate-500">
              A once-a-day email can bring you back when habits are still open.
            </p>
          </div>
          <input
            type="checkbox"
            name="reminder_enabled"
            checked={reminderEnabled}
            onChange={(event) => setReminderEnabled(event.target.checked)}
            className="mt-1 h-5 w-5 rounded border-slate-300 text-emerald-600 focus:ring-emerald-500"
          />
        </label>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label
              htmlFor="reminder-time"
              className="text-sm font-medium text-slate-700"
            >
              Reminder time
            </label>
            <input
              id="reminder-time"
              name="reminder_time"
              type="time"
              value={reminderTime}
              onChange={(event) => setReminderTime(event.target.value)}
              disabled={!reminderEnabled}
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            />
          </div>

          <div>
            <label
              htmlFor="timezone"
              className="text-sm font-medium text-slate-700"
            >
              Timezone
            </label>
            <select
              id="timezone"
              name="timezone"
              value={timezone}
              onChange={(event) => setTimezone(event.target.value)}
              disabled={!reminderEnabled}
              className="mt-2 min-h-11 w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100 disabled:cursor-not-allowed disabled:bg-slate-100"
            >
              {timezones.map((timeZoneOption) => (
                <option key={timeZoneOption} value={timeZoneOption}>
                  {timeZoneOption}
                </option>
              ))}
            </select>
          </div>
        </div>

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

        <button
          type="submit"
          disabled={isPending}
          className="inline-flex min-h-11 items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-semibold text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isPending ? "Saving..." : "Save reminders"}
        </button>
      </form>
    </section>
  );
}
