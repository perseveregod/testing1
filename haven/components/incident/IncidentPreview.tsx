"use client";

import { useState } from "react";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { dateTime } from "@/lib/time";
import type { IncidentDetail } from "@/lib/types";
import { StatusStepper, Timeline } from "./Timeline";
import { useT } from "@/lib/client/lang";
import { useClock } from "@/lib/client/safewalk";
import { Provenance } from "./Provenance";
import { STATE_STYLE, strings as stormStrings } from "@/lib/storm";
import { Check, ChevronDown, ChevronRight, ChevronUp, Share2, X } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { shareIncident } from "@/lib/client/share";
import { formatDistance } from "@/lib/geo";
import { streetAddress } from "@/lib/houston";
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
  const { t, lang, timeAgo, title, cat } = useT();
  // Ticks once a minute, for "checked 3 min ago".
  const now = useClock(true, 60_000);
  const { def, label: catLabel } = cat(incident.category);
  const ended = incident.status === "resolved";
  const storm = incident.storm;
  const sl = stormStrings(lang);

  async function confirm() {
    setBusy(true);
    try {
      const r = await apiSend<{ added: boolean }>(`/api/incidents/${incident.id}/confirm`, "POST");
      setConfirmed(true);
      toast(r.added ? t("inc.thanksConfirm") : t("inc.alreadyConfirmed"), "success");
      onChanged();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function share() {
    const r = await shareIncident(incident);
    if (r === "copied") toast(t("common.linkCopied"), "success");
    if (r === "failed") toast(t("common.shareFailed"), "error");
  }

  return (
    <div
      role="dialog"
      aria-label={t("inc.detailsOf", { t: catLabel })}
      className={`panel pointer-events-auto relative mx-auto flex w-full max-w-lg flex-col overflow-hidden rounded-card ${expanded ? "!bg-surface" : ""} ${closing ? "haven-sheet-out" : "haven-sheet-in"}`}
      style={{
        transform: dy ? `translateY(${dy}px)` : undefined,
        transition: dy ? "none" : "transform 260ms var(--ease-out), max-height 320ms var(--ease-out)",
        maxHeight: expanded ? "78dvh" : "min(56dvh, 440px)",
      }}
    >
      <div {...handlers} className="relative touch-none select-none px-4 pt-2.5">
        <button
          type="button"
          onClick={() => setExpanded((e) => !e)}
          aria-label={expanded ? t("inc.showLess") : t("inc.showMore")}
          aria-expanded={expanded}
          className="mx-auto -mt-1 mb-0 flex h-11 w-24 items-center justify-center"
        >
          <span className="h-[5px] w-9 rounded-full bg-white/20" aria-hidden />
        </button>
        <div className="flex items-start gap-3">
          <CategoryIcon category={incident.category} size="lg" muted={ended} animated glow />
          <div className="min-w-0 flex-1 pt-0.5">
            {/* The kind, unless the title already is the kind (a neighbor's report). */}
            <p className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1 text-[13px] font-medium" style={{ color: ended ? "var(--muted)" : def.color }}>
              {catLabel.toLowerCase() !== title(incident).toLowerCase() && <span className="truncate">{catLabel}</span>}
              {isLive(incident) && !storm && <LiveBadge />}
              <OriginBadge incident={incident} />
            </p>
            <h2 className="mt-0.5 line-clamp-2 text-[18px] font-bold leading-snug tracking-[-0.02em]" style={storm ? { color: STATE_STYLE[storm.state].color } : undefined}>
              {title(incident)}
            </h2>
          </div>
          <button
            onClick={onClose}
            aria-label={t("inc.closePreview")}
            className="press -mr-2 -mt-1.5 inline-flex size-11 shrink-0 items-center justify-center rounded-full bg-white/[0.06] text-muted"
          >
            <X className="size-[18px]" aria-hidden />
          </button>
        </div>
      </div>

      <div className={`relative px-4 pb-4 ${expanded ? "overflow-y-auto overscroll-contain" : ""}`}>
        <p className="mt-2.5 text-[13px] text-muted">
          {streetAddress(incident.approximateAddress) || t("inc.approx")}
          {distanceMi != null && <span className="text-text tnum"> · {t("inc.away", { d: formatDistance(distanceMi) })}</span>}
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
              {t("inc.confirmedCount", { n: incident.confirmationCount + (confirmed ? 1 : 0) })} · {sourceLabel(incident, lang)}
            </span>
          </div>
        )}

        <div className="mt-4 grid grid-cols-[1fr_auto_auto] gap-2">
          <Button variant={expanded ? "secondary" : "primary"} onClick={() => setExpanded((e) => !e)} className="whitespace-nowrap">
            {expanded ? (
              <>
                {t("common.less")} <ChevronDown className="-mr-1 size-4" aria-hidden />
              </>
            ) : (
              <>
                {t("common.details")} <ChevronUp className="-mr-1 size-4" aria-hidden />
              </>
            )}
          </Button>
          <Button
            variant={confirmed ? "accent" : "secondary"}
            onClick={confirm}
            loading={busy}
            disabled={confirmed || ended}
            aria-label={confirmed ? t("inc.confirmed") : t("inc.confirmHint")}
          >
            <Check className="size-5" strokeWidth={2.4} aria-hidden />
            <span className="max-[360px]:sr-only">{storm ? (confirmed ? sl.confirmed : sl.confirm) : confirmed ? t("inc.youSawIt") : t("inc.iSeeIt")}</span>
          </Button>
          <Button variant="secondary" onClick={share} aria-label={t("common.share")}>
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
          <img src={detail.incident.photo} alt={t("inc.photoAlt")} className="mt-4 max-h-64 w-full rounded-card object-cover" />
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
                <dt className="w-24 shrink-0 text-muted">{t("inc.reported")}</dt>
                <dd className="tnum">{dateTime(incident.createdAt)}</dd>
              </div>
              <div className="flex gap-4 py-2.5">
                <dt className="w-24 shrink-0 text-muted">{t("inc.lastUpdate")}</dt>
                <dd className="tnum">{timeAgo(detail?.incident.updates.at(-1)?.createdAt ?? incident.updatedAt)}</dd>
              </div>
            </dl>
            <Provenance incident={incident} now={now} className="mt-4" />
            <h3 className="mb-3 mt-5 text-[13px] font-medium text-muted">{t("inc.timeline")}</h3>
            {detail ? <Timeline updates={detail.incident.updates} /> : <p className="text-[13px] text-faint">{t("common.loading")}</p>}
            <ButtonLink href={`/incidents/${incident.id}`} transitionTypes={["nav-forward"]} variant="ghost" size="sm" className="mt-4">
              {t("inc.openPage")} <ChevronRight className="-mr-1 size-4" aria-hidden />
            </ButtonLink>
          </div>
        )}
      </div>
    </div>
  );
}
