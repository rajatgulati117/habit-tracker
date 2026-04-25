import { type WeeklyInsightRow } from "@/lib/weekly-insights";

type InsightTimelineProps = {
  insights: WeeklyInsightRow[];
};

function formatWeekLabel(weekStart: string) {
  const start = new Date(`${weekStart}T00:00:00`);
  const end = new Date(`${weekStart}T00:00:00`);
  end.setDate(end.getDate() + 6);

  return `${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(start)} - ${new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  }).format(end)}`;
}

function formatGeneratedAt(value: string) {
  return new Intl.DateTimeFormat("en-US", {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  }).format(new Date(value));
}

export function InsightTimeline({ insights }: InsightTimelineProps) {
  return (
    <section className="rounded-[2rem] border border-white/70 bg-white/85 p-6 shadow-sm backdrop-blur sm:p-8">
      <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
        Past Insights
      </p>
      <h2 className="mt-3 text-2xl font-semibold tracking-tight text-slate-900">
        Weekly notes you can revisit over time
      </h2>
      <p className="mt-3 max-w-2xl text-sm leading-7 text-slate-600">
        Expand any week to reread the coaching note that was generated for it.
      </p>

      {insights.length === 0 ? (
        <div className="mt-5 rounded-[1.75rem] border border-dashed border-slate-200 bg-slate-50/80 p-6 text-sm text-slate-600">
          No insights have been generated yet. Once you create one from the weekly summary page, it will show up here.
        </div>
      ) : (
        <div className="mt-6 space-y-4">
          {insights.map((insight, index) => (
            <details
              key={insight.id}
              open={index === 0}
              className="rounded-[1.5rem] border border-slate-200 bg-slate-50/80 p-4 shadow-sm"
            >
              <summary className="cursor-pointer list-none">
                <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <p className="text-sm font-semibold uppercase tracking-[0.22em] text-emerald-700">
                      Week of {insight.week_start}
                    </p>
                    <p className="mt-1 text-lg font-semibold text-slate-900">
                      {formatWeekLabel(insight.week_start)}
                    </p>
                  </div>
                  <p className="text-sm text-slate-500">
                    Generated {formatGeneratedAt(insight.generated_at)}
                  </p>
                </div>
              </summary>

              <div className="mt-4 rounded-[1.25rem] border border-white/80 bg-white px-4 py-4 text-sm leading-7 text-slate-700">
                {insight.insight_text}
              </div>
            </details>
          ))}
        </div>
      )}
    </section>
  );
}
