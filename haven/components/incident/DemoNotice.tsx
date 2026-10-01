"use client";

import { FlaskConical } from "lucide-react";
import { useT } from "@/lib/client/lang";

/**
 * Shown once above any list that contains only demo incidents, so nobody
 * mistakes the examples for real events. Each row keeps its own Demo tag.
 */
export function DemoNotice({ className = "" }: { className?: string }) {
  const { t } = useT();
  return (
    <div
      role="note"
      className={`mt-2 flex items-center gap-3 rounded-control bg-white/[0.05] px-3.5 py-2.5 text-[13px] leading-snug text-muted ${className}`}
    >
      <FlaskConical className="size-4 shrink-0 text-faint" aria-hidden />
      <span>
        <span className="font-semibold text-text/85">{t("demo.lead")}</span>
        {t("demo.body")}
      </span>
    </div>
  );
}
