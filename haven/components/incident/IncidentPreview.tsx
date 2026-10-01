"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { dateTime } from "@/lib/time";
import type { IncidentDetail } from "@/lib/types";
import { StatusStepper, Timeline } from "./Timeline";
import { useStormPrefs } from "@/lib/client/stormMode";
import { STATE_STYLE, strings as stormStrings, stormTitle } from "@/lib/storm";
import { Check, ChevronDown, ChevronRight, ChevronUp, Share2, X } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { shareIncident } from "@/lib/client/share";
import { getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import { timeAgo } from "@/lib/time";
import type { PublicIncident } from "@/lib/types";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, ButtonLink } from "@/components/ui/Button";
import { useDragDismiss, usePresence } from "@/components/ui/Sheet";
import { isLive, LiveBadge, OriginBadge, SeverityLabel, sourceLabel, StatusPill } from "./Badges";
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
  const [expanded, setExpanded] = useState(false);
  const { dy, handlers } = useDragDismiss(expanded ? () => setExpanded(false) : onClose, () => setExpanded(true));
  // Full details load only once the sheet is expanded.
  const { data: detail } = useSWR<{ incident: IncidentDetail }>(expanded ? `/api/incidents/${incident.id}` : null, fetcher);
  const def = getCategory(incident.category);
  const ended = incident.status === "resolved";
  const { lang } = useStormPrefs();
  const storm = incident.storm;
  const sl = stormStrings(lang);

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
      className={`glass pointer-events-auto relative mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-card ${closing ? "haven-sheet-out" : "haven-sheet-in"}`}
      style={{
        transform: dy ? `translateY(${dy}px)` : undefined,
        transition: dy ? "none" : "transform 260ms var(--ease-out), max-height 320ms var(--ease-out)",
        maxHeight: expanded ? "78dvh" : "min(56dvh, 440px)",
      }}
    >
      <div
        className="pointer-events-none absolute inset-x-0 top-0 h-32 rounded-t-card opacity-30"
        style={{ background: `radial-gradient(80% 100% at 50% 0%, ${def.color} 0%, transparent 70%)` }}
        aria-hidden
      />
      <div {...handlers} className="relative touch-none select-none px-4 pt-2.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? "Show less" : "Show more"}
          aria-expanded={expanded}
          className="mx-auto -mt-1 mb-0 flex h-11 w-24 items-center justify-center"
        >
          <span className="h-[5px] w-9 rounded-full bg-white/20" aria-hidden />
        </button>
        <div className="flex items-start gap-3">
          <CategoryIcon category={incident.category} size="lg" muted={ended} animated glow />
          <div className="min-w-0 flex-1 pt-0.5">
            <p className="flex min-w-0 items-center gap-2 text-[13px] font-medium" style={{ color: ended ? "var(--muted)" : def.color }}>
              <span className="truncate">{def.label}</span>
              {isLive(incident) && !storm && <LiveBadge />}
              <OriginBadge incident={incident} />
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug tracking-[-0.02em]" style={storm ? { color: STATE_STYLE[storm.state].color } : undefined}>
              {storm ? stormTitle(storm, lang) : incident.title}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label="Close preview"
            className="press -mr-2 -mt-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>

      <div className={`relative px-4 pb-4 ${expanded ? "overflow-y-auto overscroll-contain" : ""}`}>
        <p className="mt-2.5 text-[13.5px] text-muted">
          {incident.approximateAddress || "Approximate location"}
          {distanceMi != null && <span className="text-text tnum"> · {formatDistance(distanceMi)} away</span>}
          <span className="tnum"> · {timeAgo(incident.createdAt)}</span>
        </p>
        {incident.description && (
          <p className={`mt-2.5 text-[15px] leading-[1.5] text-text/85 ${expanded ? "" : "line-clamp-2"}`}>{incident.description}</p>
        )}
        {!storm && (
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1.5 text-[13px]">
            <StatusPill status={incident.status} />
            <SeverityLabel severity={incident.severity} />
            <span className="text-muted tnum">
              {incident.confirmationCount + (confirmed ? 1 : 0)} confirmed · {sourceLabel(incident)}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <Button variant={expanded ? "secondary" : "primary"} onClick={() => setExpanded((e) => !e)} className="whitespace-nowrap">
            {expanded ? (
              <>
                Less <ChevronDown className="-mr-1 size-4" aria-hidden />
              </>
            ) : (
              <>
                Details <ChevronUp className="-mr-1 size-4" aria-hidden />
              </>
            )}
          </Button>
          <Button
            variant={confirmed ? "accent" : "secondary"}
            onClick={confirm}
            loading={busy}
            disabled={confirmed || ended}
            aria-label={confirmed ? "Confirmed" : "Confirm you see this too"}
          >
            <Check className="size-5" strokeWidth={2.4} aria-hidden />
            <span className="max-[360px]:sr-only">{storm ? (confirmed ? sl.confirmed : sl.confirm) : confirmed ? "You saw it" : "I see it"}</span>
          </Button>
          <Button variant="secondary" onClick={share} aria-label="Share">
            <Share2 className="size-5" aria-hidden />
          </Button>
        </div>

        {storm && (
          <p className="mt-2 text-[13px] font-medium text-muted tnum">
            {incident.confirmationCount + (confirmed ? 1 : 0) > 0 ? sl.confirms(incident.confirmationCount + (confirmed ? 1 : 0)) : sl.noConfirms}
          </p>
        )}
        {expanded && detail?.incident.photo && (
          // eslint-disable-next-line @next/next/no-img-element -- stored data URL
          <img src={detail.incident.photo} alt="Photo from the person who reported this" className="mt-4 max-h-64 w-full rounded-[16px] object-cover" />
        )}
        {expanded && (
          <div className="mt-5 border-t border-line pt-4">
            {incident.status !== "under_review" && (
              <div className="rounded-card bg-surface px-4 pb-3 pt-4">
                <StatusStepper status={incident.status} color={def.color} />
              </div>
            )}
            <dl className="mt-4 divide-y divide-line text-[14px]">
              <div className="flex gap-4 py-2.5">
                <dt className="w-24 shrink-0 text-muted">Reported</dt>
                <dd className="tnum">{dateTime(incident.createdAt)}</dd>
              </div>
              <div className="flex gap-4 py-2.5">
                <dt className="w-24 shrink-0 text-muted">Source</dt>
                <dd className="min-w-0 text-muted">{incident.source.attribution}</dd>
              </div>
            </dl>
            <h3 className="mb-3 mt-5 text-[13px] font-medium text-muted">Timeline</h3>
            {detail ? <Timeline updates={detail.incident.updates} /> : <p className="text-[13px] text-faint">Loading…</p>}
            <ButtonLink href={`/incidents/${incident.id}`} transitionTypes={["nav-forward"]} variant="ghost" size="sm" className="mt-4">
              Open full page <ChevronRight className="-mr-1 size-4" aria-hidden />
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
