"use client";

import { ArrowUp } from "lucide-react";
import { activeLabel } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";

/**
 * The line above the list: a breathing dot while official feeds are being
 * checked, the shared "N active · 5 mi" count, and when the feeds were last
 * checked (amber once that's more than 20 minutes ago).
 */
export function LiveStatus({
  activeCount,
  checkedAt,
  stale,
  now,
}: {
  activeCount: number;
  checkedAt: number | null;
  stale: boolean;
  now: number;
}) {
  const { t, es, timeAgo } = useT();
  const live = checkedAt != null && now > 0;
  return (
    <p className="flex min-h-7 items-center justify-between gap-3 pb-1 pt-2 text-[13px] text-faint tnum">
      <span className="flex items-center gap-2">
        {live && (
          <span
            className={`live-dot ${stale ? "live-dot-stale" : ""}`}
            role="img"
            aria-label={t(stale ? "feed.delayed" : "feed.live")}
            title={t("feed.liveHint")}
          />
        )}
        <span>
          {activeLabel(activeCount, undefined, es)}
          {t("feed.last24")}
        </span>
      </span>
      {live && (
        <span className={`shrink-0 ${stale ? "text-warn" : ""}`}>
          {t(stale ? "fresh.shortStale" : "fresh.short", { t: timeAgo(new Date(checkedAt).toISOString(), now) })}
        </span>
      )}
    </p>
  );
}

/** "3 new" at the top of the screen while fresh rows sit above the fold. */
export function NewItemsPill({ count, onClick }: { count: number; onClick: () => void }) {
  const { t } = useT();
  if (!count) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-30 flex justify-center" style={{ top: "calc(var(--safe-top) + 112px)" }}>
      <button
        type="button"
        onClick={onClick}
        className="press pointer-events-auto pill-in flex min-h-10 items-center gap-1.5 rounded-full bg-brand px-4 text-[14px] font-semibold text-white shadow-lg shadow-black/30"
      >
        <ArrowUp className="size-4" strokeWidth={2.4} aria-hidden />
        {count === 1 ? t("feed.newOne") : t("feed.newMany", { n: count })}
      </button>
    </div>
  );
}
