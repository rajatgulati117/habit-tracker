import { createHmac, timingSafeEqual } from "node:crypto";
import {
  isValidTimeZone,
  normalizeReminderTime,
} from "./reminder-preferences.ts";
import {
  formatHabitFrequency,
  formatHabitTarget,
  formatProgressValue,
  getHabitDayStatus,
  type HabitCompletionRow,
  type HabitRow,
} from "./habits.ts";

export type UserPreferenceRow = {
  user_id: string;
  reminder_enabled: boolean;
  reminder_time: string;
  timezone: string;
  last_reminder_sent_at: string | null;
};

export type IncompleteHabit = {
  id: string;
  name: string;
  habitType: HabitRow["habit_type"];
  targetValue: number | null;
  unit: string | null;
  frequencyLabel: string;
  value: number | null;
};

const DEFAULT_APP_URL = "http://localhost:3000";
function getDateParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-CA", {
    timeZone,
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  });
  const parts = formatter.formatToParts(date);

  return {
    year: parts.find((part) => part.type === "year")?.value ?? "0000",
    month: parts.find((part) => part.type === "month")?.value ?? "01",
    day: parts.find((part) => part.type === "day")?.value ?? "01",
  };
}

function getTimeParts(date: Date, timeZone: string) {
  const formatter = new Intl.DateTimeFormat("en-GB", {
    timeZone,
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
  const parts = formatter.formatToParts(date);

  return {
    hour: Number(parts.find((part) => part.type === "hour")?.value ?? "0"),
    minute: Number(parts.find((part) => part.type === "minute")?.value ?? "0"),
  };
}

export function getLocalIsoDate(date: Date, timeZone: string) {
  const { year, month, day } = getDateParts(date, timeZone);
  return `${year}-${month}-${day}`;
}

export function isReminderDue(
  reminderTime: string,
  timeZone: string,
  currentDate = new Date(),
) {
  const normalized = normalizeReminderTime(reminderTime);

  if (!normalized || !isValidTimeZone(timeZone)) {
    return false;
  }

  const [hourText, minuteText] = normalized.split(":");
  const reminderMinuteOfDay = Number(hourText) * 60 + Number(minuteText);
  const { hour, minute } = getTimeParts(currentDate, timeZone);
  const currentMinuteOfDay = hour * 60 + minute;
  const delta = currentMinuteOfDay - reminderMinuteOfDay;

  return delta >= 0 && delta < 60;
}

export function wasReminderSentToday(
  lastSentAt: string | null,
  timeZone: string,
  currentDate = new Date(),
) {
  if (!lastSentAt) {
    return false;
  }

  return (
    getLocalIsoDate(new Date(lastSentAt), timeZone) ===
    getLocalIsoDate(currentDate, timeZone)
  );
}

export function getAppUrl() {
  return (
    process.env.APP_URL ||
    (process.env.VERCEL_PROJECT_PRODUCTION_URL
      ? `https://${process.env.VERCEL_PROJECT_PRODUCTION_URL}`
      : null) ||
    (process.env.VERCEL_URL ? `https://${process.env.VERCEL_URL}` : null) ||
    DEFAULT_APP_URL
  );
}

function signUnsubscribePayload(payload: string) {
  const secret = process.env.REMINDER_SIGNING_SECRET;

  if (!secret) {
    throw new Error("Missing REMINDER_SIGNING_SECRET.");
  }

  return createHmac("sha256", secret).update(payload).digest("hex");
}

export function createUnsubscribeToken(userId: string, expiresAt: string) {
  const payload = `${userId}:${expiresAt}`;
  return signUnsubscribePayload(payload);
}

export function verifyUnsubscribeToken(
  userId: string,
  expiresAt: string,
  token: string,
) {
  if (!userId || !expiresAt || !token) {
    return false;
  }

  if (Number.isNaN(Date.parse(expiresAt)) || Date.parse(expiresAt) < Date.now()) {
    return false;
  }

  const expected = signUnsubscribePayload(`${userId}:${expiresAt}`);
  const expectedBuffer = Buffer.from(expected);
  const tokenBuffer = Buffer.from(token);

  if (expectedBuffer.length !== tokenBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, tokenBuffer);
}

export function getIncompleteHabitsForDate(input: {
  habits: HabitRow[];
  completions: HabitCompletionRow[];
  isoDate: string;
}): IncompleteHabit[] {
  const completionMap = new Map<string, number | null>();

  input.completions.forEach((completion) => {
    completionMap.set(completion.habit_id, completion.value ?? null);
  });

  return input.habits.reduce<IncompleteHabit[]>((items, habit) => {
      const habitType = habit.habit_type ?? "boolean";
      const targetValue = habit.target_value ?? null;
      const value = completionMap.get(habit.id) ?? null;
      const status = getHabitDayStatus({
        createdAt: habit.created_at,
        frequencyType: habit.frequency_type ?? "daily",
        frequencyValue: habit.frequency_value ?? null,
        frequencyDays: habit.frequency_days ?? [],
        habitType,
        targetValue,
        iso: input.isoDate,
        hasCompletion: completionMap.has(habit.id),
        value,
      });

      if (status.completed || !status.expected) {
        return items;
      }

      items.push({
        id: habit.id,
        name: habit.name,
        habitType,
        targetValue,
        unit: habit.unit ?? null,
        frequencyLabel: formatHabitFrequency(
          habit.frequency_type ?? "daily",
          habit.frequency_value ?? null,
          habit.frequency_days ?? [],
        ),
        value,
      });

      return items;
    }, []);
}

function getDisplayName(name: string | null | undefined, email: string) {
  if (name?.trim()) {
    return name.trim();
  }

  return email.split("@")[0] || "there";
}

function formatIncompleteHabitLine(habit: IncompleteHabit) {
  if (habit.habitType === "quantified") {
    return `${habit.name}: ${formatProgressValue(habit.value)} of ${formatHabitTarget(
      habit.targetValue,
      habit.unit,
    )}`;
  }

  return `${habit.name}: not checked off yet`;
}

export function buildReminderEmailHtml(input: {
  name: string | null | undefined;
  email: string;
  habits: IncompleteHabit[];
  unsubscribeUrl: string;
  appUrl: string;
}) {
  const displayName = getDisplayName(input.name, input.email);
  const habitItems = input.habits
    .map(
      (habit) =>
        `<li style="margin:0 0 10px;padding:0;color:#334155;font-size:15px;line-height:1.6;"><strong>${habit.name}</strong><br /><span>${formatIncompleteHabitLine(habit)}</span><br /><span style="color:#64748b;">${habit.frequencyLabel}</span></li>`,
    )
    .join("");

  return `
    <div style="background:#f8fafc;padding:32px 16px;font-family:Arial,sans-serif;">
      <div style="max-width:560px;margin:0 auto;background:#ffffff;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 20px 45px rgba(15,23,42,0.08);">
        <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#10b981;font-weight:700;">Habit Tracker</p>
        <h1 style="margin:0 0 16px;font-size:28px;line-height:1.2;color:#0f172a;">Hi ${displayName}, a few habits are still open today.</h1>
        <p style="margin:0 0 20px;font-size:15px;line-height:1.7;color:#475569;">Here are the habits that still need attention before today wraps up.</p>
        <ul style="margin:0 0 24px;padding-left:18px;">${habitItems}</ul>
        <a href="${input.appUrl}" style="display:inline-block;background:#0f172a;color:#ffffff;text-decoration:none;padding:14px 20px;border-radius:999px;font-weight:700;">Open Habit Tracker</a>
        <p style="margin:24px 0 0;font-size:13px;line-height:1.7;color:#64748b;">Not helpful anymore? <a href="${input.unsubscribeUrl}" style="color:#0f172a;">Unsubscribe from daily reminders</a>.</p>
      </div>
    </div>
  `.trim();
}
