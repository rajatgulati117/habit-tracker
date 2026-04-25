"use server";

import { revalidatePath } from "next/cache";
import {
  normalizeCategoryColor,
  validateCategoryColor,
  validateCategoryName,
  type CategoryOption,
  type CategoryRow,
} from "@/lib/categories";
import {
  getWeekStartIso,
  normalizeFrequencyDays,
  getTodayIso,
  shiftIsoDate,
  validateHabitFrequency,
  normalizeCompletionValue,
  validateHabitName,
  validateHabitUnit,
  validateTargetValue,
  type FrequencyType,
  type HabitCompletionRow,
  type HabitType,
  type HabitRow,
} from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";
import {
  buildWeeklyInsightContext,
  generateGroqWeeklyInsight,
  type WeeklyInsightRow,
} from "@/lib/weekly-insights";
import {
  normalizeReminderTime,
  isValidTimeZone,
} from "@/lib/reminder-preferences";

type ActionResult = {
  error?: string;
};

type CategoryActionResult = ActionResult & {
  category?: CategoryOption;
};

type WeeklyInsightActionResult = ActionResult & {
  insight?: WeeklyInsightRow;
  cached?: boolean;
};

function getDatabaseErrorMessage(error: { code?: string; message?: string } | null) {
  if (!error) {
    return null;
  }

  if (
    error.code === "PGRST205" ||
    error.code === "42703" ||
    error.code === "42P01" ||
    error.message?.includes("schema cache") ||
    error.message?.includes("Could not find the table") ||
    error.message?.includes("column") ||
    error.message?.includes("relation")
  ) {
    return "Your Supabase tables are not set up yet. Run the SQL migration first, then try again.";
  }

  return null;
}

function getCategoryDatabaseErrorMessage(
  error: { code?: string; message?: string } | null,
) {
  const schemaError = getDatabaseErrorMessage(error);

  if (schemaError) {
    return schemaError;
  }

  if (error?.code === "23505") {
    return "You already have a category with that name.";
  }

  return null;
}

async function getAuthenticatedContext() {
  const supabase = createClient();
  const {
    data: { user },
    error,
  } = await supabase.auth.getUser();

  if (error || !user) {
    return { supabase, user: null, error: "You need to be logged in." };
  }

  return { supabase, user, error: null };
}

export async function addHabit(input: {
  name: string;
  categoryId?: string | null;
  habitType?: HabitType;
  targetValue?: number | null;
  unit?: string | null;
  frequencyType?: FrequencyType;
  frequencyValue?: number | null;
  frequencyDays?: number[] | null;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const validationError = validateHabitName(input.name);

  if (validationError) {
    return { error: validationError };
  }

  const name = input.name.trim();
  const categoryId = input.categoryId?.trim() || null;
  const habitType = input.habitType ?? "boolean";
  const normalizedTargetValue =
    input.targetValue == null ? null : Number(input.targetValue);
  const unit = input.unit?.trim() || null;
  const frequencyType = input.frequencyType ?? "daily";
  const frequencyValue =
    input.frequencyValue == null ? null : Number(input.frequencyValue);
  const frequencyDays = normalizeFrequencyDays(input.frequencyDays);

  if (habitType !== "boolean" && habitType !== "quantified") {
    return { error: "Choose a valid habit type." };
  }

  if (
    frequencyType !== "daily" &&
    frequencyType !== "weekly_count" &&
    frequencyType !== "specific_days"
  ) {
    return { error: "Choose a valid schedule." };
  }

  const targetError = validateTargetValue(normalizedTargetValue, habitType);

  if (targetError) {
    return { error: targetError };
  }

  const unitError = validateHabitUnit(unit);

  if (unitError) {
    return { error: unitError };
  }

  const frequencyError = validateHabitFrequency({
    frequencyType,
    frequencyValue,
    frequencyDays,
  });

  if (frequencyError) {
    return { error: frequencyError };
  }

  if (categoryId) {
    const { data: category, error: categoryError } = await supabase
      .from("categories")
      .select("id")
      .eq("id", categoryId)
      .eq("user_id", user.id)
      .single();

    if (categoryError || !category) {
      const databaseError = getCategoryDatabaseErrorMessage(categoryError);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "Choose a valid category." };
    }
  }

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name,
    category_id: categoryId,
    habit_type: habitType,
    target_value: habitType === "quantified" ? normalizedTargetValue : null,
    unit: habitType === "quantified" ? unit : null,
    frequency_type: frequencyType,
    frequency_value: frequencyType === "weekly_count" ? frequencyValue : null,
    frequency_days:
      frequencyType === "specific_days" ? frequencyDays : null,
  });

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not create the habit. Please try again." };
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  return {};
}

export async function createCategory(input: {
  name: string;
  color: string;
}): Promise<CategoryActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const nameError = validateCategoryName(input.name);

  if (nameError) {
    return { error: nameError };
  }

  const colorError = validateCategoryColor(input.color);

  if (colorError) {
    return { error: colorError };
  }

  const normalizedName = input.name.trim();
  const normalizedColor = normalizeCategoryColor(input.color);

  const { data, error } = await supabase
    .from("categories")
    .insert({
      user_id: user.id,
      name: normalizedName,
      color: normalizedColor,
    })
    .select("id, name, color")
    .single();

  if (error || !data) {
    const databaseError = getCategoryDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not create that category." };
  }

  revalidatePath("/");
  revalidatePath("/settings/categories");

  return {
    category: {
      id: data.id,
      name: data.name,
      color: data.color,
    },
  };
}

export async function updateCategory(input: {
  categoryId: string;
  name: string;
  color: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const nameError = validateCategoryName(input.name);

  if (nameError) {
    return { error: nameError };
  }

  const colorError = validateCategoryColor(input.color);

  if (colorError) {
    return { error: colorError };
  }

  const normalizedName = input.name.trim();
  const normalizedColor = normalizeCategoryColor(input.color);

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, user_id")
    .eq("id", input.categoryId)
    .eq("user_id", user.id)
    .single();

  if (categoryError || !category) {
    const databaseError = getCategoryDatabaseErrorMessage(categoryError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That category is unavailable." };
  }

  if (category.user_id !== user.id) {
    return { error: "You can only update your own categories." };
  }

  const { error } = await supabase
    .from("categories")
    .update({
      name: normalizedName,
      color: normalizedColor,
    })
    .eq("id", input.categoryId)
    .eq("user_id", user.id);

  if (error) {
    const databaseError = getCategoryDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not update that category." };
  }

  revalidatePath("/");
  revalidatePath("/settings/categories");
  return {};
}

export async function deleteCategory(input: {
  categoryId: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const { data: category, error: categoryError } = await supabase
    .from("categories")
    .select("id, user_id")
    .eq("id", input.categoryId)
    .eq("user_id", user.id)
    .single();

  if (categoryError || !category) {
    const databaseError = getCategoryDatabaseErrorMessage(categoryError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That category is unavailable." };
  }

  if (category.user_id !== user.id) {
    return { error: "You can only delete your own categories." };
  }

  const { error } = await supabase
    .from("categories")
    .delete()
    .eq("id", input.categoryId)
    .eq("user_id", user.id);

  if (error) {
    const databaseError = getCategoryDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not delete that category." };
  }

  revalidatePath("/");
  revalidatePath("/settings/categories");
  return {};
}

export async function updateHabitName(input: {
  habitId: string;
  newName: string;
  frequencyType?: FrequencyType;
  frequencyValue?: number | null;
  frequencyDays?: number[] | null;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const validationError = validateHabitName(input.newName);

  if (validationError) {
    return { error: validationError };
  }

  const trimmedName = input.newName.trim();
  const frequencyType = input.frequencyType ?? "daily";
  const frequencyValue =
    input.frequencyValue == null ? null : Number(input.frequencyValue);
  const frequencyDays = normalizeFrequencyDays(input.frequencyDays);

  if (
    frequencyType !== "daily" &&
    frequencyType !== "weekly_count" &&
    frequencyType !== "specific_days"
  ) {
    return { error: "Choose a valid schedule." };
  }

  const frequencyError = validateHabitFrequency({
    frequencyType,
    frequencyValue,
    frequencyDays,
  });

  if (frequencyError) {
    return { error: frequencyError };
  }

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, user_id")
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", false)
    .single();

  if (habitError || !habit) {
    const databaseError = getDatabaseErrorMessage(habitError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That habit is unavailable." };
  }

  if (habit.user_id !== user.id) {
    return { error: "You can only update your own habits." };
  }

  const { error } = await supabase
    .from("habits")
    .update({
      name: trimmedName,
      frequency_type: frequencyType,
      frequency_value: frequencyType === "weekly_count" ? frequencyValue : null,
      frequency_days:
        frequencyType === "specific_days" ? frequencyDays : null,
    })
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", false);

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not update that habit name." };
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  return {};
}

export async function toggleHabitCompletion(input: {
  habitId: string;
  completed: boolean;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const todayIso = getTodayIso();

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, habit_type")
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", false)
    .single();

  if (habitError || !habit) {
    const databaseError = getDatabaseErrorMessage(habitError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That habit is unavailable." };
  }

  if (habit.habit_type === "quantified") {
    return {
      error: "Quantified habits use the value controls instead of a checkbox.",
    };
  }

  if (input.completed) {
    const { error } = await supabase.from("habit_completions").upsert(
      {
        habit_id: input.habitId,
        user_id: user.id,
        completed_on: todayIso,
      },
      {
        onConflict: "habit_id,completed_on",
      },
    );

    if (error) {
      const databaseError = getDatabaseErrorMessage(error);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "Could not save today’s completion." };
    }
  } else {
    const { error } = await supabase
      .from("habit_completions")
      .delete()
      .eq("habit_id", input.habitId)
      .eq("user_id", user.id)
      .eq("completed_on", todayIso);

    if (error) {
      const databaseError = getDatabaseErrorMessage(error);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "Could not update today’s completion." };
    }
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  return {};
}

export async function updateQuantifiedHabitValue(input: {
  habitId: string;
  value: number;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const todayIso = getTodayIso();
  const normalizedValue = normalizeCompletionValue(input.value);

  if (normalizedValue == null) {
    return { error: "Enter a valid number." };
  }

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, user_id, habit_type")
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", false)
    .single();

  if (habitError || !habit) {
    const databaseError = getDatabaseErrorMessage(habitError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That habit is unavailable." };
  }

  if (habit.user_id !== user.id) {
    return { error: "You can only update your own habits." };
  }

  if (habit.habit_type !== "quantified") {
    return { error: "Only quantified habits can store numeric values." };
  }

  if (normalizedValue <= 0) {
    const { error } = await supabase
      .from("habit_completions")
      .delete()
      .eq("habit_id", input.habitId)
      .eq("user_id", user.id)
      .eq("completed_on", todayIso);

    if (error) {
      const databaseError = getDatabaseErrorMessage(error);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "Could not clear today’s value." };
    }
  } else {
    const { error } = await supabase.from("habit_completions").upsert(
      {
        habit_id: input.habitId,
        user_id: user.id,
        completed_on: todayIso,
        value: normalizedValue,
      },
      {
        onConflict: "habit_id,completed_on",
      },
    );

    if (error) {
      const databaseError = getDatabaseErrorMessage(error);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "Could not save today’s value." };
    }
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  return {};
}

export async function archiveHabit(input: {
  habitId: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ archived: true })
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", false);

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not archive that habit." };
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  return {};
}

export async function restoreHabit(input: {
  habitId: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, user_id")
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", true)
    .single();

  if (habitError || !habit) {
    const databaseError = getDatabaseErrorMessage(habitError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That archived habit is unavailable." };
  }

  if (habit.user_id !== user.id) {
    return { error: "You can only restore your own habits." };
  }

  const { error } = await supabase
    .from("habits")
    .update({ archived: false })
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", true);

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not restore that habit." };
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  revalidatePath("/settings/archived");
  return {};
}

export async function deleteHabitPermanently(input: {
  habitId: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const { data: habit, error: habitError } = await supabase
    .from("habits")
    .select("id, user_id")
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", true)
    .single();

  if (habitError || !habit) {
    const databaseError = getDatabaseErrorMessage(habitError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "That archived habit is unavailable." };
  }

  if (habit.user_id !== user.id) {
    return { error: "You can only delete your own habits." };
  }

  const { error } = await supabase
    .from("habits")
    .delete()
    .eq("id", input.habitId)
    .eq("user_id", user.id)
    .eq("archived", true);

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not delete that habit." };
  }

  revalidatePath("/");
  revalidatePath("/summary");
  revalidatePath("/history");
  revalidatePath("/settings/archived");
  return {};
}

export async function generateWeeklyInsight(
  weekStart: string,
): Promise<WeeklyInsightActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const normalizedWeekStart = getWeekStartIso(weekStart);
  const weekEnd = shiftIsoDate(normalizedWeekStart, 6);

  const { data: existingInsight, error: existingInsightError } = await supabase
    .from("weekly_insights")
    .select("id, user_id, week_start, insight_text, generated_at")
    .eq("user_id", user.id)
    .eq("week_start", normalizedWeekStart)
    .maybeSingle();

  if (existingInsightError) {
    const databaseError = getDatabaseErrorMessage(existingInsightError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not check for an existing insight." };
  }

  if (existingInsight) {
    return {
      insight: existingInsight as WeeklyInsightRow,
      cached: true,
    };
  }

  const [{ data: categoriesData, error: categoriesError }, { data: habitsData, error: habitsError }] =
    await Promise.all([
      supabase
        .from("categories")
        .select("id, user_id, name, color, created_at")
        .eq("user_id", user.id)
        .order("name", { ascending: true }),
      supabase
        .from("habits")
        .select(
          "id, name, created_at, category_id, habit_type, target_value, unit, frequency_type, frequency_value, frequency_days",
        )
        .eq("user_id", user.id)
        .eq("archived", false)
        .order("created_at", { ascending: true }),
    ]);

  if (categoriesError || habitsError) {
    const databaseError = getDatabaseErrorMessage(categoriesError ?? habitsError);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not load the weekly insight data." };
  }

  const habits = (habitsData ?? []) as HabitRow[];
  const categories = (categoriesData ?? []) as CategoryRow[];

  if (habits.length === 0) {
    return { error: "Add at least one active habit before generating an insight." };
  }

  const habitIds = habits.map((habit) => habit.id);
  let completions: HabitCompletionRow[] = [];

  if (habitIds.length > 0) {
    const { data: completionsData, error: completionsError } = await supabase
      .from("habit_completions")
      .select("habit_id, completed_on, value")
      .eq("user_id", user.id)
      .in("habit_id", habitIds)
      .lte("completed_on", weekEnd);

    if (completionsError) {
      const databaseError = getDatabaseErrorMessage(completionsError);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "Could not load your completion history for the insight." };
    }

    completions = (completionsData ?? []) as HabitCompletionRow[];
  }

  const context = buildWeeklyInsightContext({
    habits,
    categories,
    completions,
    weekStartIso: normalizedWeekStart,
  });

  try {
    const insightText = await generateGroqWeeklyInsight(context);

    console.info(
      `[weekly-insights] provider=groq model=llama-3.1-8b-instant user=${user.id} week_start=${normalizedWeekStart} generated_at=${new Date().toISOString()}`,
    );

    const { data: insertedInsight, error: insertError } = await supabase
      .from("weekly_insights")
      .insert({
        user_id: user.id,
        week_start: normalizedWeekStart,
        insight_text: insightText,
      })
      .select("id, user_id, week_start, insight_text, generated_at")
      .single();

    if (insertError || !insertedInsight) {
      if (insertError?.code === "23505") {
        const { data: raceInsight } = await supabase
          .from("weekly_insights")
          .select("id, user_id, week_start, insight_text, generated_at")
          .eq("user_id", user.id)
          .eq("week_start", normalizedWeekStart)
          .maybeSingle();

        if (raceInsight) {
          return {
            insight: raceInsight as WeeklyInsightRow,
            cached: true,
          };
        }
      }

      const databaseError = getDatabaseErrorMessage(insertError);

      if (databaseError) {
        return { error: databaseError };
      }

      return { error: "The insight was generated, but it could not be saved." };
    }

    revalidatePath("/summary");
    revalidatePath("/history");

    return {
      insight: insertedInsight as WeeklyInsightRow,
      cached: false,
    };
  } catch (error) {
    console.error("[weekly-insights] generation_failed", {
      userId: user.id,
      weekStart: normalizedWeekStart,
      message: error instanceof Error ? error.message : String(error),
    });

    return {
      error:
        "The AI insight service is having trouble right now. Please try again in a minute.",
    };
  }
}

export async function saveReminderPreferences(input: {
  reminderEnabled: boolean;
  reminderTime: string;
  timezone: string;
}): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const reminderTime = normalizeReminderTime(input.reminderTime);

  if (!reminderTime) {
    return { error: "Choose a valid reminder time." };
  }

  const timezone = input.timezone.trim();

  if (!timezone || !isValidTimeZone(timezone)) {
    return { error: "Choose a valid timezone." };
  }

  const { error } = await supabase.from("user_preferences").upsert(
    {
      user_id: user.id,
      reminder_enabled: input.reminderEnabled,
      reminder_time: reminderTime,
      timezone,
    },
    {
      onConflict: "user_id",
    },
  );

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not save your reminder settings." };
  }

  revalidatePath("/settings/reminders");
  return {};
}
