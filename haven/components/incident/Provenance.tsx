"use client";

import { ExternalLink } from "lucide-react";
import { useFeedFreshness } from "@/lib/client/hooks";
import { sourceText, useT } from "@/lib/client/lang";
import { originOf, severityMeaning, statusMeaning } from "@/lib/incidentBasis";
import type { PublicIncident } from "@/lib/types";
import { OriginBadge, SeverityLabel, StatusPill } from "./Badges";

/**
 * Who said what. Keeps three things apart that are easy to blur: what an
 * official source reported, what a person reported, and what Haven worked out
 * from it (status and severity), each with the reason beside it.
 */
export function Provenance({ incident, now, className = "" }: { incident: PublicIncident; now: number; className?: string }) {
  const { t, lang, timeAgo } = useT();
  const fresh = useFeedFreshness(now);
  const origin = originOf(incident);
  const src = sourceText(incident.source, lang);
  const status = statusMeaning(incident);
  return (
    <section aria-labelledby={`prov-${incident.id}`} className={className}>
      <h3 id={`prov-${incident.id}`} className="mb-2 text-[13px] font-medium text-muted">
        {t("prov.title")}
      </h3>
      <dl className="divide-y divide-line rounded-card bg-surface px-4">
        <Item label={t("inc.source")}>
          <p className="flex flex-wrap items-center gap-x-2 gap-y-0.5">
            <OriginBadge incident={incident} size="md" />
            {origin === "official" && <span className="text-[14px]">{src.name}</span>}
          </p>
          <p className="mt-1 text-[13px] leading-snug text-muted">
            {origin === "official" ? t("prov.officialBody") : origin === "community" ? t("prov.communityBody") : src.attribution}
          </p>
          {origin === "official" && <p className="mt-1 text-[12px] leading-snug text-faint">{src.attribution}</p>}
          {incident.source.url && (
            <a
              href={incident.source.url}
              target="_blank"
              rel="noopener noreferrer"
              className="-ml-1 mt-0.5 inline-flex min-h-11 items-center gap-1.5 rounded-control px-1 text-[14px] font-medium text-brand"
            >
              {t("prov.viewSource")} <ExternalLink className="size-3.5" aria-hidden />
            </a>
          )}
        </Item>
        {incident.status !== "under_review" || origin !== "demo" ? (
          <Item label={t("inc.status")}>
            <StatusPill status={incident.status} />
            <p className="mt-1 text-[13px] leading-snug text-muted">{t(status.key, status.vars)}</p>
          </Item>
        ) : null}
        {!incident.storm && (
          <Item label={t("prov.severity")}>
            <SeverityLabel severity={incident.severity} />
            <p className="mt-1 text-[13px] leading-snug text-muted">{t(severityMeaning(incident))}</p>
          </Item>
        )}
        {origin === "official" && fresh.checkedAt != null && now > 0 && (
          <Item label={t("prov.checked")}>
            {fresh.stale ? (
              <p className="text-[14px] font-medium leading-snug text-warn tnum" role="status">
                {t("prov.checkedStale", { t: timeAgo(new Date(fresh.checkedAt).toISOString(), now) })}
              </p>
            ) : (
              <p className="text-[14px] tnum">{timeAgo(new Date(fresh.checkedAt).toISOString(), now)}</p>
            )}
          </Item>
        )}
      </dl>
    </section>
  );
}

function Item({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <div className="flex gap-4 py-3">
      <dt className="w-20 shrink-0 pt-px text-[14px] text-muted">{label}</dt>
      <dd className="min-w-0 flex-1">{children}</dd>
    </div>
  );
}
