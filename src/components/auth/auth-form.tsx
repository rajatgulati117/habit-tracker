"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { FormEvent, useEffect, useMemo, useState, useTransition } from "react";
import { createClient } from "@/lib/supabase/client";

type AuthFormProps = {
  mode: "login" | "signup";
  initialMessage?: string;
};

const copy = {
  login: {
    eyebrow: "Welcome back",
    title: "Sign in to your account",
    description: "Use your email and password to continue to your dashboard.",
    button: "Sign in",
    loading: "Signing in...",
    alternateLabel: "Need an account?",
    alternateHref: "/signup",
    alternateText: "Create one",
  },
  signup: {
    eyebrow: "Create account",
    title: "Start with email and password",
    description: "Create your account to save habits and completions securely.",
    button: "Create account",
    loading: "Creating account...",
    alternateLabel: "Already have an account?",
    alternateHref: "/login",
    alternateText: "Sign in",
  },
} as const;

export function AuthForm({ mode, initialMessage }: AuthFormProps) {
  const router = useRouter();
  const supabase = useMemo(() => createClient(), []);
  const content = copy[mode];
  const [isNavigating, startTransition] = useTransition();

  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [infoMessage, setInfoMessage] = useState(initialMessage ?? "");
  const [isSubmitting, setIsSubmitting] = useState(false);

  useEffect(() => {
    router.prefetch("/");
    router.prefetch(content.alternateHref);
  }, [content.alternateHref, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsSubmitting(true);
    setErrorMessage(null);
    setInfoMessage("");

    try {
      if (mode === "signup") {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
        });

        if (error) {
          setErrorMessage(error.message);
          return;
        }

        if (data.session) {
          setInfoMessage("Opening your dashboard...");
          startTransition(() => {
            router.replace("/");
          });
          return;
        }

        router.replace(
          "/login?message=Check%20your%20email%20to%20confirm%20your%20account%2C%20then%20sign%20in.",
        );
        router.refresh();
        return;
      }

      const { error } = await supabase.auth.signInWithPassword({
        email,
        password,
      });

      if (error) {
        setErrorMessage(error.message);
        return;
      }

      setInfoMessage("Opening your dashboard...");
      startTransition(() => {
        router.replace("/");
      });
    } catch {
      setErrorMessage("Something went wrong. Please try again.");
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <div className="w-full max-w-md rounded-[2rem] border border-white/80 bg-white/90 p-8 shadow-xl shadow-slate-200/60 backdrop-blur">
      <p className="text-xs font-semibold uppercase tracking-[0.32em] text-emerald-600">
        {content.eyebrow}
      </p>
      <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900">
        {content.title}
      </h1>
      <p className="mt-3 text-sm leading-6 text-slate-600">
        {content.description}
      </p>

      {infoMessage ? (
        <div className="mt-6 rounded-2xl border border-emerald-200 bg-emerald-50 px-4 py-3 text-sm text-emerald-800">
          {infoMessage}
        </div>
      ) : null}

      {errorMessage ? (
        <div className="mt-6 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </div>
      ) : null}

      <form className="mt-6 space-y-4" onSubmit={handleSubmit}>
        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Email
          </span>
          <input
            type="email"
            autoComplete="email"
            required
            value={email}
            onChange={(event) => setEmail(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            placeholder="you@example.com"
          />
        </label>

        <label className="block">
          <span className="mb-2 block text-sm font-medium text-slate-700">
            Password
          </span>
          <input
            type="password"
            autoComplete={mode === "login" ? "current-password" : "new-password"}
            required
            minLength={6}
            value={password}
            onChange={(event) => setPassword(event.target.value)}
            className="w-full rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-slate-900 outline-none transition focus:border-emerald-400 focus:bg-white focus:ring-4 focus:ring-emerald-100"
            placeholder="At least 6 characters"
          />
        </label>

        <button
          type="submit"
          disabled={isSubmitting || isNavigating}
          className="inline-flex w-full items-center justify-center rounded-2xl bg-slate-900 px-4 py-3 text-sm font-medium text-white transition hover:bg-slate-800 disabled:cursor-not-allowed disabled:bg-slate-400"
        >
          {isSubmitting || isNavigating ? content.loading : content.button}
        </button>
      </form>

      <p className="mt-6 text-sm text-slate-600">
        {content.alternateLabel}{" "}
        <Link
          href={content.alternateHref}
          className="font-semibold text-emerald-700 transition hover:text-emerald-600"
        >
          {content.alternateText}
        </Link>
      </p>
    </div>
  );
}
