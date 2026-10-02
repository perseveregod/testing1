"use client";

import { useState } from "react";
import { MapPinned, Navigation } from "lucide-react";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { useT } from "@/lib/client/lang";
import type { LatLng } from "@/lib/geo";
import { chooseArea, useLocation } from "@/components/providers/LocationProvider";
import { SearchSheet } from "@/components/map/SearchSheet";
import { Spinner } from "@/components/ui/States";

/**
 * The two ways to say where "nearby" is: share location, or pick a
 * neighborhood by hand. Shown wherever a screen is not using a live position.
 * Real buttons, so they work from the keyboard and with a screen reader.
 */
export function AreaActions({ onChosen, className = "" }: { onChosen?: (p: LatLng) => void; className?: string }) {
  const { position, lastPosition, status, request } = useLocation();
  const { t } = useT();
  const [open, setOpen] = useState(false);
  if (position) return null;
  const blocked = status === "denied" || status === "unavailable";
  // First visit (no area yet): two clear buttons. Once an area is known the
  // same two actions stay within reach as quiet links, so they don't nag.
  const quiet = lastPosition != null;
  const btn = quiet
    ? "press -mx-1 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-[13px] font-semibold"
    : "press inline-flex min-h-11 items-center gap-1.5 whitespace-nowrap rounded-full px-3 text-[13px] font-semibold";
  return (
    <div className={className}>
      <div className={`flex flex-wrap items-center ${quiet ? "gap-x-5" : "gap-2"}`}>
        {!blocked && (
          <button type="button" onClick={request} disabled={status === "locating"} className={`${btn} ${quiet ? "text-brand" : "bg-brand/15 text-brand"}`}>
            {status === "locating" ? <Spinner className="size-4" /> : <Navigation className="size-4" aria-hidden />}
            {t("common.useMyLocation")}
          </button>
        )}
        <button type="button" onClick={() => setOpen(true)} className={`${btn} ${quiet ? "text-brand" : "bg-surface-2 text-text"}`}>
          <MapPinned className="size-4" aria-hidden />
          {quiet ? t("area.change") : t("area.choose")}
        </button>
      </div>
      {blocked && !quiet && <p className="mt-1 text-[13px] leading-snug text-muted">{t("area.blocked")}</p>}
      <SearchSheet
        open={open}
        onClose={() => setOpen(false)}
        near={lastPosition ?? DEFAULT_CENTER}
        title={t("area.choose")}
        onPick={(p) => {
          chooseArea(p);
          onChosen?.(p);
        }}
      />
    </div>
  );
}
