export default function OfflinePage() {
  return (
    <section className="mx-auto flex min-h-screen w-full max-w-3xl items-center px-4 py-10 sm:px-6">
      <div className="w-full rounded-[2.25rem] border border-white/70 bg-white/90 p-8 shadow-sm backdrop-blur sm:p-10">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          Offline mode
        </p>
        <h1 className="mt-4 text-3xl font-semibold tracking-tight text-slate-900 sm:text-4xl">
          Habit Tracker can&apos;t reach the network right now.
        </h1>
        <p className="mt-4 text-sm leading-7 text-slate-600 sm:text-base">
          If you revisit a page you&apos;ve already opened, the app shell can still
          load from cache. For anything new, reconnect to the internet and try
          again.
        </p>
        <div className="mt-6 rounded-[1.5rem] border border-slate-200 bg-slate-50/80 px-5 py-4">
          <p className="text-sm font-medium text-slate-900">What still works</p>
          <p className="mt-2 text-sm leading-6 text-slate-600">
            Previously cached pages, scripts, styles, and images can load. Live
            account data and new server responses wait for a connection.
          </p>
        </div>
      </div>
    </section>
  );
}
