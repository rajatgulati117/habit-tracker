"use server";

import { revalidatePath } from "next/cache";
import { getTodayIso, validateHabitName } from "@/lib/habits";
import { createClient } from "@/lib/supabase/server";

type ActionResult = {
  error?: string;
};

function getDatabaseErrorMessage(error: { code?: string; message?: string } | null) {
  if (!error) {
    return null;
  }

  if (error.code === "PGRST205" || error.message?.includes("schema cache")) {
    return "Your Supabase tables are not set up yet. Run the SQL migration first, then try again.";
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

export async function addHabit(input: { name: string }): Promise<ActionResult> {
  const { supabase, user, error: authError } = await getAuthenticatedContext();

  if (authError || !user) {
    return { error: authError ?? "You need to be logged in." };
  }

  const validationError = validateHabitName(input.name);

  if (validationError) {
    return { error: validationError };
  }

  const name = input.name.trim();

  const { error } = await supabase.from("habits").insert({
    user_id: user.id,
    name,
  });

  if (error) {
    const databaseError = getDatabaseErrorMessage(error);

    if (databaseError) {
      return { error: databaseError };
    }

    return { error: "Could not create the habit. Please try again." };
  }

  revalidatePath("/");
  return {};
}

export async function updateHabitName(input: {
  habitId: string;
  newName: string;
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
    .update({ name: trimmedName })
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
    .select("id")
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
  revalidatePath("/settings/archived");
  return {};
}
