"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { archiveHabit } from "@/app/(protected)/actions";

type ArchiveButtonProps = {
  habitId: string;
};

export function ArchiveButton({ habitId }: ArchiveButtonProps) {
  const router = useRouter();
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  function handleArchive() {
    setErrorMessage(null);

    startTransition(() => {
      void (async () => {
        const result = await archiveHabit({ habitId });

        if (result.error) {
          setErrorMessage(result.error);
          return;
        }

        router.refresh();
      })();
    });
  }

  return (
    <div className="flex flex-col items-end gap-2">
      <button
        type="button"
        onClick={handleArchive}
        disabled={isPending}
        className="inline-flex items-center rounded-full border border-slate-200 px-3 py-1.5 text-sm font-medium text-slate-600 transition hover:border-slate-300 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-60"
      >
        {isPending ? "Archiving..." : "Archive"}
      </button>

      {errorMessage ? (
        <p className="max-w-[14rem] text-right text-xs text-rose-600">
          {errorMessage}
        </p>
      ) : null}
    </div>
  );
}
