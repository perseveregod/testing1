"use client";

import { useState } from "react";
import { Check, ChevronRight, Share2, X } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { shareIncident } from "@/lib/client/share";
import { getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useDragDismiss, usePresence } from "@/components/ui/Sheet";
import { DemoTag, SeverityLabel, sourceLabel, StatusPill } from "./Badges";
import { CategoryIcon } from "./CategoryIcon";

/** Floating preview card shown when a map marker is tapped. Drag down to dismiss. */
export function IncidentPreview({
  incident,
  distanceMi,
  onClose,
  onChanged,
}: {
  incident: PublicIncident | null;
  distanceMi: number | null;
  onClose: () => void;
  onChanged: () => void;
}) {
  const { mounted, closing } = usePresence(Boolean(incident));
  const [last, setLast] = useState(incident);
  if (incident && incident !== last) setLast(incident);
  const shown = incident ?? last;
  if (!mounted || !shown) return null;
  return (
    <PreviewCard
      key={shown.id}
      incident={shown}
      distanceMi={distanceMi}
      closing={closing}
      onClose={onClose}
      onChanged={onChanged}
    />
  );
}

function PreviewCard({
  incident,
  distanceMi,
  closing,
  onClose,
  onChanged,
}: {
  incident: PublicIncident;
  distanceMi: number | null;
  closing: boolean;
  onClose: () => void;
  onChanged: () => void;
}) {
  const toast = useToast();
  const [busy, setBusy] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const { dy, handlers } = useDragDismiss(onClose);
  const def = getCategory(incident.category);
  const ended = incident.status === "resolved";

  async function confirm() {
    setBusy(true);
    try {
      const r = await apiSend<{ added: boolean }>(`/api/incidents/${incident.id}/confirm`, "POST");
      setConfirmed(true);
      toast(r.added ? "Thanks. Your confirmation helps others." : "You already confirmed this.", "success");
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const r = await shareIncident(incident);
    if (r === "copied") toast("Link copied", "success");
    if (r === "failed") toast("Couldn't share this link", "error");
  }

  return (
    <div
      role="dialog"
      aria-label={`${def.label} details`}
      className={`glass pointer-events-auto relative mx-auto w-full max-w-lg overflow-hidden rounded-[24px] ${closing ? "haven-sheet-out" : "haven-sheet-in"}`}
      style={{
        transform: dy ? `translateY(${dy}px)` : undefined,
        transition: dy ? "none" : "transform 260ms var(--ease-out)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-[24px] opacity-30"
        style={{ background: `radial-gradient(80% 100% at 50% 0%, ${def.color} 0%, transparent 70%)` }}
        aria-hidden
      />
      <div {...handlers} className="relative touch-none select-none px-4 pt-2.5">
        <div className="mx-auto mb-2.5 h-[5px] w-9 rounded-full bg-white/15" aria-hidden />
        <div className="flex items-start gap-3">
          <CategoryIcon category={incident.category} size="lg" muted={ended} animated glow />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="flex items-center gap-2 text-[13px] font-medium" style={{ color: ended ? "var(--muted)" : def.color }}>
              {def.label}
              {incident.isDemo && <DemoTag />}
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-[18px] font-semibold leading-snug tracking-[-0.015em]">{incident.title}</h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="press -mr-1.5 -mt-1 inline-flex size-9 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>

      <div className="relative px-4 pb-4">
        <p className="mt-2.5 text-[13.5px] text-muted">
          {incident.approximateAddress || "Approximate location"}
          {distanceMi != null && <span className="text-text tnum"> · {formatDistance(distanceMi)} away</span>}
          <span className="tnum"> · {timeAgo(incident.createdAt)}</span>
        </p>
        {incident.description && (
          <p className="mt-2.5 line-clamp-3 text-[15px] leading-[1.5] text-text/85">{incident.description}</p>
        )}
        <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
          <StatusPill status={incident.status} />
          <SeverityLabel severity={incident.severity} />
          <span className="text-muted tnum">
            {incident.confirmationCount + (confirmed ? 1 : 0)} confirmed · {sourceLabel(incident)}
          </span>
        </div>

        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <ButtonLink href={`/incidents/${incident.id}`} transitionTypes={["nav-forward"]} className="whitespace-nowrap">
            Details <ChevronRight className="-mr-1 size-4" aria-hidden />
          </ButtonLink>
          <Button
            variant={confirmed ? "accent" : "secondary"}
            onClick={confirm}
            loading={busy}
            disabled={confirmed || ended}
            aria-label={confirmed ? "Confirmed" : "Confirm you see this too"}
          >
            <Check className="size-5" strokeWidth={2.4} aria-hidden />
            <span className="max-[360px]:sr-only">{confirmed ? "Confirmed" : "Confirm"}</span>
          </Button>
          <Button variant="secondary" onClick={share} aria-label="Share">
            <Share2 className="size-5" aria-hidden />
          </Button>
        </div>
      </div>
    </div>
  );
}
