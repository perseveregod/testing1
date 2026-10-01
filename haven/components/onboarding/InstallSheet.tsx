"use client";

import { Share, SquarePlus, Bell } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";

/** How to put Haven on the Home Screen, which is what unlocks push on iPhone. */
export function InstallSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const steps = [
    { icon: Share, title: "Tap the Share button", body: "The square with an arrow at the bottom of Safari." },
    { icon: SquarePlus, title: "Choose “Add to Home Screen”", body: "Scroll the list a little if you don't see it." },
    { icon: Bell, title: "Open Haven from the Home Screen", body: "Then come back to Alerts and turn on notifications." },
  ];
  return (
    <Sheet open={open} onClose={onClose} title="Add Haven to your Home Screen">
      <p className="mb-4 text-[14.5px] leading-relaxed text-muted">
        Haven runs as an app from your Home Screen: full screen, faster, and it can notify you even when it&apos;s closed.
      </p>
      <ol className="space-y-2 pb-2">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-start gap-3.5 rounded-card bg-surface-2 p-3.5">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-brand/15 text-brand">
              <s.icon className="size-[18px]" aria-hidden />
            </span>
            <span className="min-w-0">
              <span className="block text-[15px] font-semibold tracking-[-0.01em]">
                <span className="sr-only">Step {i + 1}: </span>
                {s.title}
              </span>
              <span className="block text-[13.5px] leading-snug text-muted">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
    </Sheet>
  );
}
