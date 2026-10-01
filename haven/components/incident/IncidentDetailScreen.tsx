"use client";

import { useState } from "react";
import useSWR from "swr";
import { Check, CircleSlash, Flag, MessageSquarePlus, Share2 } from "lucide-react";
import { apiSend, errorMessage, fetcher } from "@/lib/client/api";
import { shareIncident } from "@/lib/client/share";
import { getCategory } from "@/lib/categories";
import { formatDistance } from "@/lib/geo";
import { dateTime, timeAgo } from "@/lib/time";
import type { IncidentDetail } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { EmergencyNote } from "@/components/EmergencyNote";
import { MiniMap } from "@/components/map/MiniMap";
import { PageHeader } from "@/components/nav/PageHeader";
import { ActionButton, ButtonLink } from "@/components/ui/Button";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";
import { DemoTag, isLive, LiveBadge, SeverityLabel, StatusPill } from "./Badges";
import { CategoryIcon } from "./CategoryIcon";
import { AddInfoSheet, FlagSheet } from "./IncidentActions";
import { StatusStepper, Timeline } from "./Timeline";

export function IncidentDetailScreen({ id }: { id: string }) {
  const { position } = useLocation();
  const toast = useToast();
  const qs = position ? `?lat=${position.lat.toFixed(3)}&lng=${position.lng.toFixed(3)}` : "";
  const { data, error, isLoading, mutate } = useSWR<{ incident: IncidentDetail }>(`/api/incidents/${id}${qs}`, fetcher, {
    keepPreviousData: true,
    refreshInterval: 60_000,
  });
  const [busy, setBusy] = useState<"confirm" | "ended" | null>(null);
  const [infoOpen, setInfoOpen] = useState(false);
  const [flagOpen, setFlagOpen] = useState(false);
  const incident = data?.incident;

  async function vote(kind: "confirm" | "ended") {
    setBusy(kind);
    try {
      await apiSend(`/api/incidents/${id}/${kind}`, "POST");
      toast(kind === "confirm" ? "Thanks. Your neighbors will see it was confirmed." : "Thanks. We'll update the status.", "success");
      await mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  async function share() {
    if (!incident) return;
    const r = await shareIncident(incident);
    if (r === "copied") toast("Link copied", "success");
    if (r === "failed") toast("Couldn't share this link", "error");
  }

  if (isLoading && !incident) {
    return (
      <main className="min-h-dvh pb-nav">
        <PageHeader title="" back />
        <div className="mx-auto max-w-lg px-5 pt-2" aria-busy>
          <div className="flex gap-3.5">
            <Skeleton className="size-12 rounded-full" />
            <div className="flex-1 space-y-2.5 pt-1">
              <Skeleton className="h-3 w-24" />
              <Skeleton className="h-6 w-3/4" />
            </div>
          </div>
          <Skeleton className="mt-5 h-44 w-full rounded-card" />
          <Skeleton className="mt-4 h-4 w-full" />
          <Skeleton className="mt-2 h-4 w-5/6" />
        </div>
      </main>
    );
  }

  if (error || !incident) {
    const notFound = (error as { status?: number } | undefined)?.status === 404;
    return (
      <main className="min-h-dvh pb-nav">
        <PageHeader title="" back />
        {notFound ? (
          <EmptyState
            icon={<CircleSlash className="size-9" strokeWidth={1.5} aria-hidden />}
            title="Incident unavailable"
            body={errorMessage(error)}
            action={<ButtonLink href="/feed">Back to feed</ButtonLink>}
          />
        ) : (
          <ErrorState message={error ? errorMessage(error) : "Couldn't load this incident."} onRetry={() => mutate()} />
        )}
      </main>
    );
  }

  const def = getCategory(incident.category);
  const ended = incident.status === "resolved";
  const lastUpdate = incident.updates.at(-1)?.createdAt ?? incident.updatedAt;

  return (
    <main className="min-h-dvh pb-nav">
      {/* Full-bleed map behind the header; content scrolls up over it. */}
      <div className="absolute inset-x-0 top-0 h-[46dvh] min-h-[320px]" aria-hidden>
        <MiniMap
          className="h-full rounded-none bg-bg"
          mode="preview"
          center={{ lat: incident.latitude, lng: incident.longitude }}
          color={ended ? "#686d77" : def.color}
          label={`Map showing the approximate location: ${incident.approximateAddress}`}
          attribution={false}
        />
        <div className="absolute inset-x-0 bottom-0 h-3/4 bg-gradient-to-t from-bg via-bg/70 to-transparent" />
        <div className="absolute inset-x-0 top-0 h-28 bg-gradient-to-b from-bg/80 to-transparent" />
      </div>

      <PageHeader
        title={incident.title}
        back
        transparent
        action={
          <button onClick={share} aria-label="Share" className="press glass inline-flex size-11 items-center justify-center rounded-full">
            <Share2 className="size-[18px]" aria-hidden />
          </button>
        }
      />
      <div className="relative mx-auto max-w-lg px-5" style={{ paddingTop: "calc(46dvh - 200px)" }}>
        <div className="haven-rise">
          <div className="mb-4">
            <CategoryIcon category={incident.category} size="xl" muted={ended} animated glow />
          </div>
          <p className="flex items-center gap-2 text-[13px] font-semibold uppercase tracking-[0.1em]" style={{ color: ended ? "var(--muted)" : def.color }}>
            {isLive(incident) && <LiveBadge size="md" />}
            {def.label}
            {incident.isDemo && <DemoTag />}
          </p>
          <h2 className="mt-2 text-[34px] font-bold leading-[1.05] tracking-[-0.035em]">{incident.title}</h2>
          <div className="mt-3 flex flex-wrap items-center gap-x-4 gap-y-1">
            <StatusPill status={incident.status} />
            <SeverityLabel severity={incident.severity} />
            <span className="text-[13px] text-muted">{incident.approximateAddress}</span>
          </div>
        </div>

        {incident.status !== "under_review" && (
          <div className="haven-rise mt-6 rounded-card bg-surface px-4 pb-3 pt-4" style={{ animationDelay: "40ms" }}>
            <StatusStepper status={incident.status} color={def.color} />
          </div>
        )}

        {incident.description && (
          <p className="haven-rise mt-6 whitespace-pre-line break-words text-[17px] leading-[1.55] text-text/90" style={{ animationDelay: "80ms" }}>
            {incident.description}
          </p>
        )}

        <dl className="haven-rise mt-6 divide-y divide-line border-t border-line" style={{ animationDelay: "140ms" }}>
          <Fact label="Location" value={incident.approximateAddress || "Approximate"} />
          <Fact label="Distance" value={incident.distanceMi != null ? `${formatDistance(incident.distanceMi)} from you` : "Location off"} />
          <Fact label="Reported" value={dateTime(incident.createdAt)} />
          <Fact label="Last update" value={timeAgo(lastUpdate)} />
          <Fact label="Confirmed by" value={incident.confirmationCount === 0 ? "No one yet" : `${incident.confirmationCount} ${incident.confirmationCount === 1 ? "person" : "people"} nearby`} />
          <Fact
            label="Source"
            value={
              <>
                {incident.source.attribution}
                {incident.source.url && (
                  <>
                    {" "}
                    <a href={incident.source.url} target="_blank" rel="noopener noreferrer" className="text-brand">
                      View
                    </a>
                  </>
                )}
              </>
            }
            wrap
          />
        </dl>

        <div className="haven-rise mt-6 grid grid-cols-4 gap-2" style={{ animationDelay: "200ms" }}>
          <ActionButton
            icon={<Check className="size-[22px]" strokeWidth={2.2} />}
            label={incident.viewer.isReporter ? "Yours" : incident.viewer.confirmed ? "You saw it" : "I see it"}
            active={incident.viewer.confirmed}
            onClick={() => vote("confirm")}
            disabled={busy !== null || incident.viewer.confirmed || incident.viewer.isReporter || ended}
          />
          <ActionButton
            icon={<CircleSlash className="size-[22px]" strokeWidth={2} />}
            label={incident.viewer.markedEnded ? "Marked" : "It's over"}
            active={incident.viewer.markedEnded}
            onClick={() => vote("ended")}
            disabled={busy !== null || incident.viewer.markedEnded || ended}
          />
          <ActionButton
            icon={<MessageSquarePlus className="size-[22px]" strokeWidth={2} />}
            label="Add info"
            onClick={() => setInfoOpen(true)}
            disabled={ended}
          />
          <ActionButton icon={<Share2 className="size-[22px]" strokeWidth={2} />} label="Share" onClick={share} />
        </div>
        <p className="mt-3 text-center text-[13px] text-faint">Stay at a safe distance. Don&apos;t approach the scene.</p>

        <section className="mt-8">
          <h3 className="mb-4 text-[13px] font-medium text-muted">Timeline</h3>
          <Timeline updates={incident.updates} />
        </section>

        <div className="mt-8">
          <EmergencyNote compact />
        </div>

        <p className="mt-6 text-center text-[11.5px] text-faint">
          Map ©{" "}
          <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener noreferrer" className="underline-offset-2 hover:underline">
            OpenStreetMap contributors
          </a>{" "}
          · OpenFreeMap
        </p>

        {!incident.viewer.isReporter && (
          <button
            onClick={() => setFlagOpen(true)}
            disabled={incident.viewer.flagged}
            className="mx-auto mt-2 flex min-h-11 items-center gap-2 rounded-full px-3 text-[13.5px] text-faint hover:text-muted disabled:opacity-60"
          >
            <Flag className="size-3.5" aria-hidden />
            {incident.viewer.flagged ? "You reported a problem" : "Report a problem"}
          </button>
        )}
      </div>

      <AddInfoSheet incidentId={incident.id} open={infoOpen} onClose={() => setInfoOpen(false)} onDone={() => mutate()} />
      <FlagSheet incidentId={incident.id} open={flagOpen} onClose={() => setFlagOpen(false)} onDone={() => mutate()} />
    </main>
  );
}

function Fact({ label, value, wrap }: { label: string; value: React.ReactNode; wrap?: boolean }) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="w-24 shrink-0 text-[14px] text-muted">{label}</dt>
      <dd className={`min-w-0 flex-1 text-[14.5px] leading-snug tnum ${wrap ? "text-muted" : "truncate"}`}>{value}</dd>
    </div>
  );
}
