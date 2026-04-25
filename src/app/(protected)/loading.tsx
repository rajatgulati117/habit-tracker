function LoadingCard({
  className = "",
}: Readonly<{
  className?: string;
}>) {
  return (
    <div
      className={`rounded-[2rem] border border-white/70 bg-white/80 p-6 shadow-sm ${className}`}
    >
      <div className="h-3 w-24 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-4 h-8 w-3/4 animate-pulse rounded-full bg-slate-200" />
      <div className="mt-3 h-4 w-full animate-pulse rounded-full bg-slate-100" />
      <div className="mt-2 h-4 w-5/6 animate-pulse rounded-full bg-slate-100" />
    </div>
  );
}

export default function ProtectedLoading() {
  return (
    <div className="space-y-6">
      <LoadingCard />
      <div className="grid gap-6 xl:grid-cols-[0.92fr_1.08fr]">
        <LoadingCard className="min-h-[18rem]" />
        <LoadingCard className="min-h-[18rem]" />
      </div>
    </div>
  );
}
