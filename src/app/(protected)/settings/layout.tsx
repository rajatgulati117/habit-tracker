import Link from "next/link";

const settingsLinks = [
  {
    href: "/settings/archived",
    label: "Archived Habits",
    description: "Restore retired habits or delete them for good.",
  },
];

export default function SettingsLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <div className="grid gap-6 lg:grid-cols-[0.34fr_0.66fr]">
      <aside className="rounded-[2rem] border border-white/70 bg-white/85 p-5 shadow-sm backdrop-blur sm:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.28em] text-emerald-600">
          Settings
        </p>
        <h1 className="mt-3 text-3xl font-semibold tracking-tight text-slate-900">
          Manage the parts of your tracker you&apos;re not using every day.
        </h1>
        <nav className="mt-6 flex flex-col gap-3">
          {settingsLinks.map((link) => (
            <Link
              key={link.href}
              href={link.href}
              className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 px-4 py-4 transition hover:border-slate-200 hover:bg-white"
            >
              <p className="text-sm font-semibold text-slate-900">{link.label}</p>
              <p className="mt-1 text-sm leading-6 text-slate-500">
                {link.description}
              </p>
            </Link>
          ))}
        </nav>
      </aside>

      <div className="space-y-6">{children}</div>
    </div>
  );
}
