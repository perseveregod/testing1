"use client";

import { Share, SquarePlus, Bell } from "lucide-react";
import { useT } from "@/lib/client/lang";
import { Sheet } from "@/components/ui/Sheet";

/** How to put Haven on the Home Screen, which is what unlocks push on iPhone. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { t } = useT();
  const steps = [
    { icon: Share, title: t("install.1"), body: t("install.1b") },
    { icon: SquarePlus, title: t("install.2"), body: t("install.2b") },
    { icon: Bell, title: t("install.3"), body: t("install.3b") },
  ];
  return (
    <Sheet open={open} onClose={onClose} title={t("install.title")}>
      <p className="mb-4 text-[14px] leading-relaxed text-muted">{t("install.body")}</p>
      <ol className="space-y-2 pb-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3.5 rounded-card bg-surface-2 p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <s.icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold tracking-[-0.01em]">
                <span className="sr-only">{t("common.step", { n: i + 1 })}: </span>
                {s.title}
              </span>
              <span className="block text-[13px] leading-snug text-muted">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
