import test from "node:test";
import assert from "node:assert/strict";
import {
  buildWeeklyInsightContext,
  cleanInsightText,
} from "./weekly-insights.ts";

test("cleanInsightText normalizes legacy section labels into the app format", () => {
  const cleaned = cleanInsightText(`
    - **Performance Summary:** Weekly rate increased by 10%.
    - Completion Status: Yes/No habits reached 80%.
    - Outliers: Reading broke the trend.
    - Identified Pattern: Weekend gaps remained.
    - Actionable Step: Move reminders to 7 PM.
  `);

  assert.equal(
    cleaned,
    [
      "- **Performance:** Weekly rate increased by 10%.",
      "- **Status:** Yes/No habits reached 80%.",
      "- **Exceptions:** Reading broke the trend.",
      "- **Observation:** Weekend gaps remained.",
      "- **Adjustment:** Move reminders to 7 PM.",
    ].join("\n"),
  );
});

test("buildWeeklyInsightContext uses everyday habit terminology and includes current metrics", () => {
  const context = buildWeeklyInsightContext({
    weekStartIso: "2026-04-20",
    categories: [
      {
        id: "cat-health",
        name: "Health",
        color: "#22C55E",
        created_at: "2026-04-01T00:00:00.000Z",
      },
    ],
    habits: [
      {
        id: "habit-water",
        name: "Drink Water",
        created_at: "2026-04-01T00:00:00.000Z",
        category_id: "cat-health",
        habit_type: "quantified",
        target_value: 8,
        unit: "glasses",
        frequency_type: "daily",
        frequency_value: null,
        frequency_days: null,
      },
      {
        id: "habit-walk",
        name: "Walk",
        created_at: "2026-04-01T00:00:00.000Z",
        category_id: null,
        habit_type: "boolean",
        target_value: null,
        unit: null,
        frequency_type: "specific_days",
        frequency_value: null,
        frequency_days: [1, 3, 5],
      },
    ],
    completions: [
      {
        habit_id: "habit-water",
        completed_on: "2026-04-20",
        value: 8,
      },
      {
        habit_id: "habit-water",
        completed_on: "2026-04-21",
        value: 4,
      },
      {
        habit_id: "habit-walk",
        completed_on: "2026-04-21",
        value: null,
      },
    ],
  });

  assert.match(context, /Type: Goal-based habit, target 8 glasses/);
  assert.match(context, /Type: Yes\/No habit/);
  assert.match(context, /Category: Health/);
  assert.match(context, /Category: Uncategorized/);
  assert.match(context, /Current streak:/);
  assert.match(context, /Current week \(Apr 20 - Apr 26\):/);
  assert.match(context, /Current week daily detail:/);
});
