"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

const primaryRoutes = [
  { href: "/", label: "Today" },
  { href: "/summary", label: "Summary" },
  { href: "/history", label: "History" },
];

const settingsRoutes = ["/settings", "/settings/archived", "/settings/categories"];

function isActive(pathname: string, href: string) {
  if (href === "/") {
    return pathname === "/";
  }

  return pathname === href || pathname.startsWith(`${href}/`);
}

export function AppNav() {
  const pathname = usePathname();
  const router = useRouter();

  useEffect(() => {
    ["/", "/summary", "/history", "/settings/archived", "/settings/categories"].forEach(
      (href) => {
        router.prefetch(href);
      },
    );
  }, [router]);

  return (
    <nav className="flex items-center gap-1 sm:gap-2">
      {primaryRoutes.map((route) => {
        const active = isActive(pathname, route.href);

        return (
          <Link
            key={route.href}
            href={route.href}
            prefetch
            className={`rounded-full px-2.5 py-2 text-xs font-medium transition sm:px-3 sm:text-sm ${
              active
                ? "bg-slate-900 text-white shadow-sm"
                : "text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            }`}
          >
            {route.label}
          </Link>
        );
      })}

      <Link
        href="/settings/archived"
        prefetch
        className={`rounded-full px-2.5 py-2 text-xs font-medium transition hover:bg-slate-100 hover:text-slate-900 sm:hidden ${
          settingsRoutes.some((route) => isActive(pathname, route))
            ? "bg-slate-900 text-white shadow-sm"
            : "text-slate-600"
        }`}
      >
        Settings
      </Link>
    </nav>
  );
}
