"use client";

import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";

const INSTALL_DISMISSED_KEY = "habit-tracker:pwa-install-dismissed";
const IOS_DISMISSED_KEY = "habit-tracker:pwa-ios-dismissed";

type BeforeInstallPromptEvent = Event & {
  prompt: () => Promise<void>;
  userChoice: Promise<{
    outcome: "accepted" | "dismissed";
    platform: string;
  }>;
};

function isIosDevice() {
  if (typeof window === "undefined") {
    return false;
  }

  return /iphone|ipad|ipod/i.test(window.navigator.userAgent);
}

function isStandaloneMode() {
  if (typeof window === "undefined") {
    return false;
  }

  return (
    window.matchMedia("(display-mode: standalone)").matches ||
    Boolean((window.navigator as Navigator & { standalone?: boolean }).standalone)
  );
}

export function InstallPromptBanner() {
  const pathname = usePathname();
  const [deferredPrompt, setDeferredPrompt] =
    useState<BeforeInstallPromptEvent | null>(null);
  const [dismissed, setDismissed] = useState(true);
  const [showIosHint, setShowIosHint] = useState(false);

  const visibleOnRoute = useMemo(() => pathname === "/", [pathname]);

  useEffect(() => {
    if (!visibleOnRoute) {
      return;
    }

    if (isStandaloneMode()) {
      setDismissed(true);
      return;
    }

    const installDismissed = window.localStorage.getItem(INSTALL_DISMISSED_KEY);
    const iosDismissed = window.localStorage.getItem(IOS_DISMISSED_KEY);

    if (isIosDevice()) {
      setShowIosHint(!iosDismissed);
      setDismissed(Boolean(iosDismissed));
      return;
    }

    setDismissed(Boolean(installDismissed));

    function handleBeforeInstallPrompt(event: Event) {
      event.preventDefault();
      setDeferredPrompt(event as BeforeInstallPromptEvent);
      setDismissed(Boolean(window.localStorage.getItem(INSTALL_DISMISSED_KEY)));
    }

    function handleAppInstalled() {
      setDeferredPrompt(null);
      setDismissed(true);
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "installed");
    }

    window.addEventListener("beforeinstallprompt", handleBeforeInstallPrompt);
    window.addEventListener("appinstalled", handleAppInstalled);

    return () => {
      window.removeEventListener(
        "beforeinstallprompt",
        handleBeforeInstallPrompt,
      );
      window.removeEventListener("appinstalled", handleAppInstalled);
    };
  }, [visibleOnRoute]);

  async function handleInstall() {
    if (!deferredPrompt) {
      return;
    }

    await deferredPrompt.prompt();
    const choice = await deferredPrompt.userChoice;

    if (choice.outcome === "dismissed") {
      window.localStorage.setItem(INSTALL_DISMISSED_KEY, "dismissed");
      setDismissed(true);
    }

    setDeferredPrompt(null);
  }

  function handleDismiss() {
    const storageKey = showIosHint ? IOS_DISMISSED_KEY : INSTALL_DISMISSED_KEY;
    window.localStorage.setItem(storageKey, "dismissed");
    setDismissed(true);
  }

  if (!visibleOnRoute || dismissed || isStandaloneMode()) {
    return null;
  }

  return (
    <div className="mb-4 rounded-[1.5rem] border border-emerald-200 bg-emerald-50/90 p-4 shadow-sm backdrop-blur">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.24em] text-emerald-700">
            Install app
          </p>
          <p className="mt-1 text-sm leading-6 text-slate-700">
            {showIosHint
              ? "Tap the share button, then 'Add to Home Screen'."
              : "Install Habit Tracker for faster launch and a full-screen experience."}
          </p>
        </div>

        <div className="flex items-center gap-2 self-start sm:self-auto">
          {!showIosHint ? (
            <button
              type="button"
              onClick={handleInstall}
              className="inline-flex items-center rounded-full bg-slate-900 px-4 py-2 text-sm font-medium text-white transition hover:bg-slate-700"
            >
              Install app
            </button>
          ) : null}
          <button
            type="button"
            onClick={handleDismiss}
            className="inline-flex items-center rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 transition hover:border-slate-300 hover:bg-slate-50"
          >
            Dismiss
          </button>
        </div>
      </div>
    </div>
  );
}
