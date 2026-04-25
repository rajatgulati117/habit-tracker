import { NextResponse } from "next/server";
import { createAdminClient } from "@/lib/supabase/admin";
import { verifyUnsubscribeToken } from "@/lib/reminders";

function renderMessage(title: string, body: string, status = 200) {
  return new NextResponse(
    `<!DOCTYPE html>
    <html lang="en">
      <head>
        <meta charSet="utf-8" />
        <meta name="viewport" content="width=device-width, initial-scale=1" />
        <title>${title}</title>
      </head>
      <body style="margin:0;background:#f8fafc;font-family:Arial,sans-serif;padding:32px;">
        <main style="max-width:560px;margin:0 auto;background:white;border:1px solid #e2e8f0;border-radius:24px;padding:32px;box-shadow:0 16px 40px rgba(15,23,42,0.08);">
          <p style="margin:0 0 8px;font-size:12px;letter-spacing:0.24em;text-transform:uppercase;color:#10b981;font-weight:700;">Habit Tracker</p>
          <h1 style="margin:0 0 12px;font-size:28px;line-height:1.2;color:#0f172a;">${title}</h1>
          <p style="margin:0;font-size:15px;line-height:1.7;color:#475569;">${body}</p>
        </main>
      </body>
    </html>`,
    {
      status,
      headers: { "Content-Type": "text/html; charset=utf-8" },
    },
  );
}

export async function GET(request: Request) {
  const { searchParams } = new URL(request.url);
  const userId = searchParams.get("user") ?? "";
  const expiresAt = searchParams.get("exp") ?? "";
  const token = searchParams.get("token") ?? "";

  if (!verifyUnsubscribeToken(userId, expiresAt, token)) {
    return renderMessage(
      "Link expired",
      "This unsubscribe link is invalid or expired. Open the app and update reminders from settings instead.",
      400,
    );
  }

  try {
    const supabase = createAdminClient();
    const { error } = await supabase
      .from("user_preferences")
      .upsert({
        user_id: userId,
        reminder_enabled: false,
      });

    if (error) {
      throw error;
    }

    return renderMessage(
      "Reminders turned off",
      "Daily email reminders have been disabled for this account. You can turn them back on any time in settings.",
    );
  } catch (error) {
    console.error("[reminders] unsubscribe_failed", {
      userId,
      message: error instanceof Error ? error.message : String(error),
    });

    return renderMessage(
      "Could not update reminders",
      "The app could not disable reminders right now. Please try again later.",
      500,
    );
  }
}
