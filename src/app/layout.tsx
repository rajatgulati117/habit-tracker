import type { Metadata } from "next";
import localFont from "next/font/local";
import Link from "next/link";
import "./globals.css";
import { createClient } from "@/lib/supabase/server";

const geistSans = localFont({
  src: "./fonts/GeistVF.woff",
  variable: "--font-geist-sans",
  weight: "100 900",
});
const geistMono = localFont({
  src: "./fonts/GeistMonoVF.woff",
  variable: "--font-geist-mono",
  weight: "100 900",
});

export const metadata: Metadata = {
  title: "Habit Tracker",
  description: "Track daily habits with Supabase Auth and Next.js",
};

export default async function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  const supabase = createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return (
    <html lang="en">
      <body
        className={`${geistSans.variable} ${geistMono.variable} min-h-screen antialiased`}
      >
        <div className="min-h-screen bg-[radial-gradient(circle_at_top,_rgba(16,185,129,0.16),_transparent_30%),linear-gradient(180deg,_#f8fafc_0%,_#eef2ff_100%)]">
          <div className="mx-auto flex min-h-screen w-full max-w-6xl flex-col px-4 py-6 sm:px-6 lg:px-8">
            <header className="mb-8 flex min-h-[72px] items-center justify-between rounded-2xl border border-white/70 bg-white/75 px-4 py-3 shadow-sm backdrop-blur sm:px-6">
              <div className="flex items-center gap-3 sm:gap-6">
                <Link href="/" className="flex flex-col">
                  <span className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
                    Habit Tracker
                  </span>
                  <span className="text-sm text-slate-500">
                    Supabase Auth starter
                  </span>
                </Link>

                {user ? (
                  <nav className="flex items-center gap-1 sm:gap-2">
                    <Link
                      href="/"
                      className="rounded-full px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:px-3 sm:text-sm"
                    >
                      Today
                    </Link>
                    <Link
                      href="/summary"
                      className="rounded-full px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:px-3 sm:text-sm"
                    >
                      Summary
                    </Link>
                    <Link
                      href="/settings/archived"
                      className="rounded-full px-2.5 py-2 text-xs font-medium text-slate-600 transition hover:bg-slate-100 hover:text-slate-900 sm:hidden"
                    >
                      Settings
                    </Link>
                  </nav>
                ) : null}
              </div>

              {user ? (
                <div className="flex items-center gap-3">
                  <div className="hidden text-right sm:block">
                    <p className="text-xs font-medium uppercase tracking-[0.24em] text-slate-400">
                      Signed in as
                    </p>
                    <p className="text-sm font-medium text-slate-700">
                      {user.email}
                    </p>
                  </div>

                  <Link
                    href="/settings/archived"
                    aria-label="Open settings"
                    className="hidden h-10 w-10 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 hover:text-slate-900 sm:inline-flex"
                  >
                    <svg
                      viewBox="0 0 20 20"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="1.7"
                      className="h-4 w-4"
                      aria-hidden="true"
                    >
                      <path
                        d="M8.18 2.638a1 1 0 0 1 1.64 0l.56.812a1 1 0 0 0 1.064.4l.96-.214a1 1 0 0 1 1.306.99l.033.985a1 1 0 0 0 .69.915l.936.303a1 1 0 0 1 .507 1.56l-.57.806a1 1 0 0 0 0 1.18l.57.805a1 1 0 0 1-.507 1.56l-.936.304a1 1 0 0 0-.69.914l-.033.985a1 1 0 0 1-1.306.99l-.96-.214a1 1 0 0 0-1.064.4l-.56.812a1 1 0 0 1-1.64 0l-.56-.812a1 1 0 0 0-1.064-.4l-.96.214a1 1 0 0 1-1.306-.99l-.033-.985a1 1 0 0 0-.69-.914l-.936-.304a1 1 0 0 1-.507-1.56l.57-.806a1 1 0 0 0 0-1.18l-.57-.805a1 1 0 0 1 .507-1.56l.936-.303a1 1 0 0 0 .69-.915l.033-.985a1 1 0 0 1 1.306-.99l.96.214a1 1 0 0 0 1.064-.4l.56-.812Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                      <path
                        d="M11.75 10a1.75 1.75 0 1 1-3.5 0 1.75 1.75 0 0 1 3.5 0Z"
                        strokeLinecap="round"
                        strokeLinejoin="round"
                      />
                    </svg>
                  </Link>

                  <form action="/logout" method="post">
                    <button
                      type="submit"
                      className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
                    >
                      Logout
                    </button>
                  </form>
                </div>
              ) : null}
            </header>

            <main className="flex-1">{children}</main>
          </div>
        </div>
      </body>
    </html>
  );
}
