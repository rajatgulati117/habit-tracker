import test from "node:test";
import assert from "node:assert/strict";
import {
  createUnsubscribeToken,
  getIncompleteHabitsForDate,
  getLocalIsoDate,
  isReminderDue,
  verifyUnsubscribeToken,
  wasReminderSentToday,
} from "./reminders.ts";
import { type HabitCompletionRow, type HabitRow } from "./habits.ts";

test("reminder due stays inside the current hour window", () => {
  assert.equal(
    isReminderDue(
      "20:00:00",
      "Asia/Kolkata",
      new Date("2026-04-25T14:45:00.000Z"),
    ),
    true,
  );
  assert.equal(
    isReminderDue(
      "20:00:00",
      "Asia/Kolkata",
      new Date("2026-04-25T15:46:00.000Z"),
    ),
    false,
  );
});

test("reminder due returns false for invalid timezone or time", () => {
  assert.equal(
    isReminderDue("20:00:00", "Not/A_Zone", new Date("2026-04-25T14:45:00.000Z")),
    false,
  );
  assert.equal(
    isReminderDue("25:99:00", "Asia/Kolkata", new Date("2026-04-25T14:45:00.000Z")),
    false,
  );
});

test("local iso date respects timezone boundaries", () => {
  assert.equal(
    getLocalIsoDate(new Date("2026-04-25T23:30:00.000Z"), "Asia/Kolkata"),
    "2026-04-26",
  );
  assert.equal(
    getLocalIsoDate(new Date("2026-04-25T01:30:00.000Z"), "America/New_York"),
    "2026-04-24",
  );
});

test("already sent today compares dates inside the user's timezone", () => {
  assert.equal(
    wasReminderSentToday(
      "2026-04-25T16:00:00.000Z",
      "Asia/Kolkata",
      new Date("2026-04-25T17:30:00.000Z"),
    ),
    true,
  );
  assert.equal(
    wasReminderSentToday(
      "2026-04-24T18:00:00.000Z",
      "Asia/Kolkata",
      new Date("2026-04-25T23:00:00.000Z"),
    ),
    false,
  );
});

test("unsubscribe tokens validate and reject tampering or expiry", () => {
  process.env.REMINDER_SIGNING_SECRET = "unit-test-secret";
  const expiresAt = "2099-01-01T00:00:00.000Z";
  const token = createUnsubscribeToken("user-1", expiresAt);

  assert.equal(verifyUnsubscribeToken("user-1", expiresAt, token), true);
  assert.equal(verifyUnsubscribeToken("user-2", expiresAt, token), false);
  assert.equal(
    verifyUnsubscribeToken("user-1", "2000-01-01T00:00:00.000Z", token),
    false,
  );
});

test("incomplete habits keep only expected habits that are not completed", () => {
  const habits = [
    {
      id: "habit-1",
      name: "Drink Water",
      created_at: "2026-03-01T00:00:00.000Z",
      habit_type: "quantified",
      target_value: 8,
      unit: "glasses",
      frequency_type: "daily",
      frequency_value: null,
      frequency_days: null,
    },
    {
      id: "habit-2",
      name: "Meditate",
      created_at: "2026-03-01T00:00:00.000Z",
      habit_type: "boolean",
      target_value: null,
      unit: null,
      frequency_type: "specific_days",
      frequency_value: null,
      frequency_days: [1, 3, 5],
    },
    {
      id: "habit-3",
      name: "Read",
      created_at: "2026-03-01T00:00:00.000Z",
      habit_type: "boolean",
      target_value: null,
      unit: null,
      frequency_type: "daily",
      frequency_value: null,
      frequency_days: null,
    },
  ] satisfies HabitRow[];

  const completions = [
    {
      habit_id: "habit-1",
      completed_on: "2026-04-25",
      value: 5,
    },
    {
      habit_id: "habit-3",
      completed_on: "2026-04-25",
      value: null,
    },
  ] satisfies HabitCompletionRow[];

  const incompleteHabits = getIncompleteHabitsForDate({
    habits,
    completions,
    isoDate: "2026-04-25",
  });

  assert.deepEqual(
    incompleteHabits.map((habit) => ({
      id: habit.id,
      name: habit.name,
    })),
    [{ id: "habit-1", name: "Drink Water" }],
  );
});
