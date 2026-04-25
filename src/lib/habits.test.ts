import test from "node:test";
import assert from "node:assert/strict";
import {
  calculateHabitStreaks,
  getHabitDayStatus,
  isHabitExpectedOnDate,
  type HabitScheduleConfig,
} from "./habits.ts";

function schedule(
  overrides: Partial<HabitScheduleConfig>,
): HabitScheduleConfig {
  return {
    createdAt: "2026-03-01T00:00:00.000Z",
    frequencyType: "daily",
    frequencyValue: null,
    frequencyDays: null,
    ...overrides,
  };
}

test("daily streak counts consecutive days ending today", () => {
  const streak = calculateHabitStreaks(
    schedule({ frequencyType: "daily" }),
    ["2026-04-21", "2026-04-22", "2026-04-23"],
    "2026-04-23",
  );

  assert.deepEqual(streak, {
    current: 3,
    longest: 3,
  });
});

test("daily streak falls back to yesterday when today is incomplete", () => {
  const streak = calculateHabitStreaks(
    schedule({ frequencyType: "daily" }),
    ["2026-04-20", "2026-04-21", "2026-04-22"],
    "2026-04-23",
  );

  assert.equal(streak.current, 3);
  assert.equal(streak.longest, 3);
});

test("specific day streak ignores unscheduled days", () => {
  const streak = calculateHabitStreaks(
    schedule({
      frequencyType: "specific_days",
      frequencyDays: [1, 3, 5],
    }),
    ["2026-04-17", "2026-04-20", "2026-04-22"],
    "2026-04-23",
  );

  assert.equal(streak.current, 3);
  assert.equal(streak.longest, 3);
});

test("specific day streak breaks on the previous missed scheduled day", () => {
  const streak = calculateHabitStreaks(
    schedule({
      frequencyType: "specific_days",
      frequencyDays: [1, 3, 5],
    }),
    ["2026-04-17", "2026-04-22"],
    "2026-04-24",
  );

  assert.equal(streak.current, 1);
  assert.equal(streak.longest, 1);
});

test("weekly count streak uses Monday-Sunday boundaries and falls back to the previous completed week", () => {
  const streak = calculateHabitStreaks(
    schedule({
      frequencyType: "weekly_count",
      frequencyValue: 3,
    }),
    [
      "2026-04-07",
      "2026-04-09",
      "2026-04-11",
      "2026-04-14",
      "2026-04-15",
      "2026-04-18",
      "2026-04-21",
      "2026-04-22",
    ],
    "2026-04-22",
  );

  assert.equal(streak.current, 2);
  assert.equal(streak.longest, 2);
});

test("weekly count streak includes the current week once its target is met", () => {
  const streak = calculateHabitStreaks(
    schedule({
      frequencyType: "weekly_count",
      frequencyValue: 3,
    }),
    [
      "2026-04-07",
      "2026-04-09",
      "2026-04-11",
      "2026-04-14",
      "2026-04-15",
      "2026-04-18",
      "2026-04-20",
      "2026-04-21",
      "2026-04-22",
    ],
    "2026-04-22",
  );

  assert.equal(streak.current, 3);
  assert.equal(streak.longest, 3);
});

test("weekly count keeps Sunday in the previous week and Monday in the next week", () => {
  const streak = calculateHabitStreaks(
    schedule({
      frequencyType: "weekly_count",
      frequencyValue: 2,
    }),
    ["2026-04-13", "2026-04-19"],
    "2026-04-20",
  );

  assert.equal(streak.current, 1);
  assert.equal(streak.longest, 1);
});

test("specific day expectation only marks scheduled days", () => {
  const config = schedule({
    frequencyType: "specific_days",
    frequencyDays: [1, 2, 3, 4, 5],
  });

  assert.equal(isHabitExpectedOnDate(config, "2026-04-22"), true);
  assert.equal(isHabitExpectedOnDate(config, "2026-04-25"), false);
});

test("day status marks unscheduled days as not expected instead of missed", () => {
  const status = getHabitDayStatus({
    createdAt: "2026-03-01T00:00:00.000Z",
    frequencyType: "specific_days",
    frequencyValue: null,
    frequencyDays: [1, 2, 3, 4, 5],
    habitType: "boolean",
    targetValue: null,
    iso: "2026-04-25",
    hasCompletion: false,
    value: null,
  });

  assert.deepEqual(status, {
    expected: false,
    completed: false,
    value: null,
    progressPercent: 0,
    state: "not_expected",
  });
});
