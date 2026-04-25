"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { generateWeeklyInsight } from "@/app/(protected)/actions";
import { type WeeklyInsightRow } from "@/lib/weekly-insights";

type WeeklyInsightCardProps = {
  weekStart: string;
  initialInsight: WeeklyInsightRow | null;
  disabled?: boolean;
};

type InsightLine = {
  label: string;
  value: string;
};

function parseInsightLines(text: string): InsightLine[] {
  return text
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .map((line) => line.replace(/^[*-]\s+/, ""))
    .map((line) => {
      const boldMatch = line.match(/^\*\*(.+?):\*\*\s*(.+)$/);

      if (boldMatch) {
        return {
          label: boldMatch[1],
          value: boldMatch[2],
        };
      }

      const plainMatch = line.match(/^([^:]+):\s*(.+)$/);

      if (plainMatch) {
        return {
          label: plainMatch[1],
          value: plainMatch[2],
        };
      }

      return {
        label: "",
        value: line,
      };
    });
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function WeeklyInsightCard({
  weekStart,
  initialInsight,
  disabled = false,
}: WeeklyInsightCardProps) {
  const router = useRouter();
  const [insight, setInsight] = useState(initialInsight);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const parsedInsight = insight ? parseInsightLines(insight.insight_text) : [];

  function handleGenerate() {
    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const result = await generateWeeklyInsight(weekStart);

        if (result.error || !result.insight) {
          setErrorMessage(
            result.error ?? "Could not generate the weekly insight.",
          );
          return;
        }

        setInsight(result.insight);
        router.refresh();
      })();
    });
  }

  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
      <div className="flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
            AI Insight
          </p>
          <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
            Your weekly coaching note
          </h2>
          <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
            Get a warm, concrete read on how this week compares with the one before it.
          </p>
        </div>

        {!insight ? (
          <button
            type="button"
            onClick={handleGenerate}
            disabled={disabled || isPending}
            className="inline-flex items-center justify-center rounded-full bg-slate-900 px-5 py-3 text-sm font-medium text-white transition hover:bg-slate-700 disabled:cursor-not-allowed disabled:bg-slate-400"
          >
            {isPending ? "Generating..." : "Generate insight"}
          </button>
        ) : null}
      </div>

      {errorMessage ? (
        <p className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {errorMessage}
        </p>
      ) : null}

      {disabled && !insight ? (
        <p className="mt-4 rounded-2xl border border-slate-200 bg-slate-50 px-4 py-3 text-sm text-slate-600">
          Add at least one active habit before generating an insight.
        </p>
      ) : null}

      {insight ? (
        <div className="mt-5 rounded-[1.75rem] border border-emerald-100 bg-emerald-50/85 p-5 shadow-sm">
          {parsedInsight.length > 0 ? (
            <ul className="space-y-3 text-sm leading-7 text-slate-700">
              {parsedInsight.map((line, index) => (
                <li key={`${line.label}-${index}`} className="flex gap-2">
                  <span className="mt-[0.72rem] h-1.5 w-1.5 shrink-0 rounded-full bg-emerald-600" />
                  <span>
                    {line.label ? (
                      <span className="font-semibold text-slate-900">
                        {line.label}:
                      </span>
                    ) : null}{" "}
                    <span>{line.value}</span>
                  </span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-sm leading-7 text-slate-700">{insight.insight_text}</p>
          )}
          <p className="mt-4 text-xs font-medium uppercase tracking-[0.22em] text-emerald-700">
            Generated {formatGeneratedAt(insight.generated_at)}
          </p>
        </div>
      ) : null}
    </section>
  );
}
