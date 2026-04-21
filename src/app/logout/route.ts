import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = createClient();

  await supabase.auth.signOut();

  return NextResponse.redirect(new URL("/login?message=You%20have%20been%20signed%20out.", request.url));
}
