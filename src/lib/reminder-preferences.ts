const DEFAULT_REMINDER_TIME = "20:00";

export function normalizeReminderTime(value: string | null | undefined) {
  const raw = value?.trim() || DEFAULT_REMINDER_TIME;
  const match = raw.match(/^(\d{2}):(\d{2})(?::(\d{2}))?$/);

  if (!match) {
    return null;
  }

  const hour = Number(match[1]);
  const minute = Number(match[2]);
  const second = Number(match[3] ?? "0");

  if (hour > 23 || minute > 59 || second > 59) {
    return null;
  }

  return `${match[1]}:${match[2]}:${`${second}`.padStart(2, "0")}`;
}

export function formatReminderTimeInput(value: string | null | undefined) {
  const normalized = normalizeReminderTime(value);
  return normalized ? normalized.slice(0, 5) : DEFAULT_REMINDER_TIME;
}

export function isValidTimeZone(value: string) {
  try {
    new Intl.DateTimeFormat("en-US", { timeZone: value }).format(new Date());
    return true;
  } catch {
    return false;
  }
}
