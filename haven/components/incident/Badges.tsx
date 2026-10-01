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

export function DemoTag() {
  return (
    <span className="rounded-[5px] bg-white/[0.07] px-1.5 py-[1px] text-[10.5px] font-semibold uppercase tracking-[0.06em] text-muted">
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
