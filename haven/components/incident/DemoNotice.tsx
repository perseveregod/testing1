"use client";

import { useState } from "react";
import { ChevronRight, FlaskConical } from "lucide-react";
import { useT } from "@/lib/client/lang";
import { HowItWorksSheet } from "@/components/profile/HowItWorksSheet";

/**
 * Shown once above any list that contains only demo incidents, so nobody
 * mistakes the examples for real events. Tapping it explains why.
 */
export function DemoNotice({ className = "" }: { className?: string }) {
  const { t, es } = useT();
  const [open, setOpen] = useState(false);
  return (
    <>
      <button
        type="button"
        onClick={() => setOpen(true)}
        className={`mt-2 flex w-full items-center gap-3 rounded-control bg-white/[0.05] px-3.5 py-2.5 text-left text-[13px] leading-snug text-muted active:bg-white/[0.08] ${className}`}
      >
        <FlaskConical className="size-4 shrink-0 text-faint" aria-hidden />
        <span className="min-w-0 flex-1">
          <span className="font-semibold text-text/85">{t("demo.lead")}</span>
          {t("demo.body")}
          <span className="font-semibold text-brand"> {es ? "¿Por qué?" : "Why?"}</span>
        </span>
        <ChevronRight className="size-4 shrink-0 text-faint" aria-hidden />
      </button>
      <HowItWorksSheet open={open} onClose={() => setOpen(false)} />
    </>
  );
}
