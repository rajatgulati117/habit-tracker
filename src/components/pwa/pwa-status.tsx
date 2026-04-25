"use client";

import { useEffect, useState } from "react";

function detectStandalone() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function PwaStatus() {
  const [isStandalone, setIsStandalone] = useState(false);

  useEffect(() => {
    const mediaQuery = window.matchMedia("(display-mode: standalone)");
    const update = () => setIsStandalone(detectStandalone());

    update();
    mediaQuery.addEventListener("change", update);

    return () => {
      mediaQuery.removeEventListener("change", update);
    };
  }, []);

  return (
    <div className="rounded-[1.5rem] border border-slate-100 bg-slate-50/80 px-4 py-4">
      <p className="text-xs font-semibold uppercase tracking-[0.24em] text-slate-500">
        PWA status
      </p>
      <div className="mt-3 flex items-center gap-3">
        <span
          className={`h-2.5 w-2.5 rounded-full ${
            isStandalone ? "bg-emerald-500" : "bg-slate-300"
          }`}
        />
        <p className="text-sm font-medium text-slate-900">
          {isStandalone ? "Installed as PWA" : "Opened in browser"}
        </p>
      </div>
    </div>
  );
}
