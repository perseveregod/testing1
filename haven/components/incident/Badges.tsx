import { SEVERITY_LABEL } from "@/lib/categories";
import type { IncidentStatus, PublicIncident, Severity } from "@/lib/types";

const STATUS: Record<IncidentStatus, { label: string; cls: string; dot: string }> = {
  active: { label: "Active", cls: "text-text", dot: "bg-danger" },
  contained: { label: "Contained", cls: "text-warn", dot: "bg-warn" },
  resolved: { label: "Ended", cls: "text-faint", dot: "bg-faint" },
  under_review: { label: "Under review", cls: "text-faint", dot: "bg-faint" },
};

/** Status as a dot + word; quieter than a pill. */
export function StatusPill({ status }: { status: IncidentStatus }) {
  const s = STATUS[status];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${s.cls}`}>
      <span className="relative flex size-[7px]" aria-hidden>
        {status === "active" && <span className={`haven-pulse absolute inset-0 rounded-full ${s.dot}`} />}
        <span className={`relative size-[7px] rounded-full ${s.dot}`} />
      </span>
      {s.label}
    </span>
  );
}

const SEV_CLS: Record<Severity, string> = {
  low: "text-muted",
  moderate: "text-warn",
  high: "text-[#ff8a5c]",
  critical: "text-danger",
};

export function SeverityLabel({ severity }: { severity: Severity }) {
  const bars = { low: 1, moderate: 2, high: 3, critical: 4 }[severity];
  return (
    <span className={`inline-flex items-center gap-1.5 text-[13px] font-medium ${SEV_CLS[severity]}`}>
      <span className="flex items-end gap-[2px]" aria-hidden>
        {[1, 2, 3, 4].map((b) => (
          <span key={b} className={`w-[3px] rounded-full ${b <= bars ? "bg-current" : "bg-white/12"}`} style={{ height: 3 + b * 2 }} />
        ))}
      </span>
      {SEVERITY_LABEL[severity]}
    </span>
  );
}

/** Fictional example data. Always visible wherever a demo incident appears. */
export function DemoTag({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span
      className={`rounded-[5px] bg-white/[0.09] font-semibold uppercase tracking-[0.06em] text-text/75 ${size === "md" ? "px-2 py-[3px] text-[11px]" : "px-1.5 py-[1px] text-[10.5px]"}`}
      title="Fictional example, not a real event"
    >
      Demo
    </span>
  );
}

/** Where the information came from, in plain words. */
export function sourceLabel(i: PublicIncident): string {
  if (i.isDemo) return "Demo data";
  if (i.source.kind === "user") return i.unverified ? "Unverified report" : "Confirmed by neighbors";
  return i.source.name;
}

export function SourceBadge({ incident }: { incident: PublicIncident }) {
  if (incident.isDemo) return <DemoTag />;
  const verified = incident.source.kind !== "user" || !incident.unverified;
  return <span className={`text-[13px] ${verified ? "text-muted" : "text-faint"}`}>{sourceLabel(incident)}</span>;
}

/**
 * Worth a red LIVE badge: a real, active incident that is serious, or at least
 * moderate and under an hour old. Low-severity calls (routine EMS runs, stalled
 * cars) and demo examples never get it, so the badge keeps meaning something.
 */
export function isLive(i: Pick<PublicIncident, "status" | "severity" | "createdAt"> & { isDemo?: boolean }, now = Date.now()): boolean {
  if (i.status !== "active" || i.isDemo || i.severity === "low") return false;
  const fresh = now - new Date(i.createdAt).getTime() < 60 * 60_000;
  return fresh || i.severity === "high" || i.severity === "critical";
}

export function LiveBadge({ size = "sm" }: { size?: "sm" | "md" }) {
  return (
    <span className={`live-badge ${size === "md" ? "px-2 py-[3px] text-[11px]" : "px-1.5 py-[1px] text-[9.5px]"}`}>
      <span className="haven-blink size-[5px] rounded-full bg-white" aria-hidden />
      Live
    </span>
  );
}

/** Where a report came from, as a compact badge: Official source, Community report or Demo. */
export function OriginBadge({ incident, size = "sm" }: { incident: Pick<PublicIncident, "isDemo" | "source" | "unverified">; size?: "sm" | "md" }) {
  const cls = size === "md" ? "px-2 py-[3px] text-[11px]" : "px-1.5 py-[1px] text-[10.5px]";
  if (incident.isDemo) return <DemoTag />;
  if (incident.source.kind === "user") {
    return (
      <span className={`rounded-[5px] bg-warn/15 font-semibold uppercase tracking-[0.06em] text-warn ${cls}`}>
        Community{incident.unverified ? "" : " · confirmed"}
      </span>
    );
  }
  return (
    <span className={`rounded-[5px] bg-brand/15 font-semibold uppercase tracking-[0.06em] text-brand ${cls}`}>
      Official
    </span>
  );
}

/** Age-based fading: full strength for 2h, then eases down to 55% by 24h. */
export function recencyFactor(createdAt: string, now = Date.now()): number {
  const hours = (now - new Date(createdAt).getTime()) / 3_600_000;
  if (hours <= 2) return 1;
  return Math.max(0.55, 1 - ((hours - 2) / 22) * 0.45);
}
