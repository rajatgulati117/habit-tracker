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

test("habit is never expected before its created date", () => {
  const config = schedule({
    createdAt: "2026-04-20T00:00:00.000Z",
    frequencyType: "daily",
  });

  assert.equal(isHabitExpectedOnDate(config, "2026-04-19"), false);
  assert.equal(isHabitExpectedOnDate(config, "2026-04-20"), true);
});

test("quantified habit only counts completed once value reaches target", () => {
  const incompleteStatus = getHabitDayStatus({
    createdAt: "2026-03-01T00:00:00.000Z",
    frequencyType: "daily",
    frequencyValue: null,
    frequencyDays: null,
    habitType: "quantified",
    targetValue: 10,
    iso: "2026-04-24",
    hasCompletion: true,
    value: 7,
  });

  const completeStatus = getHabitDayStatus({
    createdAt: "2026-03-01T00:00:00.000Z",
    frequencyType: "daily",
    frequencyValue: null,
    frequencyDays: null,
    habitType: "quantified",
    targetValue: 10,
    iso: "2026-04-24",
    hasCompletion: true,
    value: 10,
  });

  assert.equal(incompleteStatus.completed, false);
  assert.equal(incompleteStatus.state, "missed");
  assert.equal(completeStatus.completed, true);
  assert.equal(completeStatus.progressPercent, 100);
});

test("weekly count streak starts from the habit creation week", () => {
  const streak = calculateHabitStreaks(
    schedule({
      createdAt: "2026-04-16T00:00:00.000Z",
      frequencyType: "weekly_count",
      frequencyValue: 2,
    }),
    ["2026-04-17", "2026-04-18", "2026-04-21", "2026-04-22"],
    "2026-04-22",
  );

  assert.deepEqual(streak, {
    current: 2,
    longest: 2,
  });
});

test("specific day streak stays at zero before the first qualifying completion", () => {
  const streak = calculateHabitStreaks(
    schedule({
      frequencyType: "specific_days",
      frequencyDays: [1, 3, 5],
    }),
    [],
    "2026-04-24",
  );

  assert.deepEqual(streak, {
    current: 0,
    longest: 0,
  });
});
