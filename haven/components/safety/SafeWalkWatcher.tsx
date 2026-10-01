"use client";

import { useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { BellRing } from "lucide-react";
import { startAlarm, stopAlarm } from "@/lib/client/alarm";
import { useClock, useSafeWalk } from "@/lib/client/safewalk";

/**
 * Mounted once for the whole app, so a missed Safe Walk check-in sounds the
 * alarm on any screen, not only on the Safe Walk page.
 */
export function SafeWalkWatcher() {
  const walk = useSafeWalk()?.walk ?? null;
  const now = useClock(walk != null);
  const path = usePathname();
  const overdue = walk != null && now > 0 && now >= walk.endsAt;

  useEffect(() => {
    if (!overdue) return;
    const title = document.title;
    document.title = "⚠️ Check in! · Haven";
    void startAlarm();
    return () => {
      stopAlarm();
      document.title = title;
    };
  }, [overdue]);

  if (!overdue || path === "/safety/walk") return null;
  return (
    <Link
      href="/safety/walk"
      className="fixed inset-x-3 z-[60] flex items-center gap-3 rounded-2xl bg-live px-4 py-3 text-white shadow-[0_10px_30px_-8px_rgba(255,45,85,0.8)]"
      style={{ top: "calc(var(--safe-top) + 8px)" }}
    >
      <BellRing className="haven-blink size-5 shrink-0" aria-hidden />
      <span className="min-w-0 flex-1">
        <span className="block text-[15px] font-bold">Safe Walk check-in missed</span>
        <span className="block text-[13px] opacity-90">Tap if you&apos;re OK, or to alert your contacts</span>
      </span>
    </Link>
  );
}
