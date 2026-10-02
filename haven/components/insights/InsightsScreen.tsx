"use client";

import { useState } from "react";
import useSWR from "swr";
import { BarChart3, TrendingDown, TrendingUp } from "lucide-react";
import { errorMessage, fetcher } from "@/lib/client/api";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { usePlaces } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import type { AreaInsights } from "@/server/services/insights";
import { useLocation } from "@/components/providers/LocationProvider";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { PageHeader } from "@/components/nav/PageHeader";
import { Chip } from "@/components/ui/Controls";
import { EmptyState, ErrorState, Skeleton } from "@/components/ui/States";

// Area insights: counts and trends from real (non-demo) incidents around a
// point. Free sees 7 days; Lifetime sees 30.

export function InsightsScreen() {
  const { position } = useLocation();
  const { places } = usePlaces();
  const [focus, setFocus] = useState<string>("me");
  const place = places.find((p) => p.id === focus);
  const center = place ? { lat: place.latitude, lng: place.longitude } : (position ?? DEFAULT_CENTER);
  const url = `/api/insights?lat=${center.lat.toFixed(3)}&lng=${center.lng.toFixed(3)}&radiusMi=3`;
  const { data, error, isLoading, mutate } = useSWR<{ insights: AreaInsights }>(url, fetcher, { keepPreviousData: true });
  const ins = data?.insights;
  const { es, cat } = useT();

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader
        title={es ? "Tendencias de la zona" : "Area insights"}
        back="/profile"
        sub={
          <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3 pt-1" role="toolbar" aria-label={es ? "Zona" : "Area"}>
            <Chip active={focus === "me"} onClick={() => setFocus("me")}>
              {es ? "Cerca de mí" : "Near me"}
            </Chip>
            {places.map((p) => (
              <Chip key={p.id} active={focus === p.id} onClick={() => setFocus(p.id)}>
                {p.label}
              </Chip>
            ))}
          </div>
        }
      />
      <div className="mx-auto max-w-lg px-5 pt-3">
        {isLoading && !ins ? (
          <div className="space-y-3" aria-busy>
            <Skeleton className="h-28 w-full rounded-card" />
            <Skeleton className="h-40 w-full rounded-card" />
          </div>
        ) : error ? (
          <ErrorState message={errorMessage(error)} onRetry={() => mutate()} />
        ) : !ins || ins.total === 0 ? (
          <EmptyState
            icon={<BarChart3 className="size-9" strokeWidth={1.5} aria-hidden />}
            title={es ? "Aún no hay nada que graficar" : "Nothing to chart yet"}
            body={
              es
                ? `No hay incidentes reales a menos de 3 millas en los últimos ${ins?.days ?? 7} días. Los datos de demostración no cuentan.`
                : `No real incidents within 3 miles in the last ${ins?.days ?? 7} days. Demo data isn't counted.`
            }
          />
        ) : (
          <>
            <div className="flex items-end justify-between">
              <div>
                <p className="text-[13px] text-muted">
                  {es ? `Últimos ${ins.days} días · a menos de ${ins.radiusMi} mi` : `Last ${ins.days} days · within ${ins.radiusMi} mi`}
                </p>
                <p className="mt-1 text-[44px] font-bold leading-none tracking-[-0.04em] tnum">{ins.total}</p>
                <p className="mt-1 text-[14px] text-muted">{es ? "incidentes" : "incidents"}</p>
              </div>
              {ins.trend != null && (
                <div className={`flex items-center gap-1.5 rounded-full px-3 py-1.5 text-[13px] font-medium ${ins.trend > 1.1 ? "bg-danger/12 text-danger" : ins.trend < 0.9 ? "bg-ok/12 text-ok" : "bg-surface-2 text-muted"}`}>
                  {ins.trend > 1.1 ? <TrendingUp className="size-4" aria-hidden /> : ins.trend < 0.9 ? <TrendingDown className="size-4" aria-hidden /> : null}
                  {Math.round(Math.abs(ins.trend - 1) * 100)}% {es ? (ins.trend >= 1 ? "más que antes" : "menos que antes") : `${ins.trend >= 1 ? "more" : "fewer"} than before`}
                </div>
              )}
            </div>

            <DayChart days={ins.byDay} className="mt-6" es={es} />

            <section className="mt-7">
              <h2 className="mb-3 text-[13px] font-medium text-muted">{es ? "Por categoría" : "By category"}</h2>
              <ul className="space-y-3">
                {ins.byCategory.map((c) => {
                  const { def, label } = cat(c.category);
                  return (
                    <li key={c.category} className="flex items-center gap-3">
                      <CategoryIcon category={c.category} size="sm" />
                      <div className="min-w-0 flex-1">
                        <div className="flex items-baseline justify-between text-[14px]">
                          <span>{label}</span>
                          <span className="text-muted tnum">{c.count}</span>
                        </div>
                        <div className="mt-1.5 h-1.5 overflow-hidden rounded-full bg-surface-2">
                          <div className="h-full rounded-full transition-[width] duration-700 ease-[var(--ease-out)]" style={{ width: `${Math.max(4, c.share * 100)}%`, background: def.color }} />
                        </div>
                      </div>
                    </li>
                  );
                })}
              </ul>
            </section>

            {ins.busiestHour != null && (
              <p className="mt-6 text-[14px] text-muted">
                {es ? "Hora más activa: " : "Busiest hour: "}
                <span className="text-text tnum">{formatHour(ins.busiestHour, es)}</span>
              </p>
            )}
          </>
        )}

      </div>
    </main>
  );
}

function formatHour(h: number, es = false) {
  // The server counts by UTC hour; show it in the viewer's own time zone.
  const now = new Date();
  const d = new Date(Date.UTC(now.getUTCFullYear(), now.getUTCMonth(), now.getUTCDate(), h));
  return d.toLocaleTimeString(es ? "es-US" : undefined, { hour: "numeric" });
}

/** Simple bar chart, one bar per day; no library needed. */
function DayChart({ days, className = "", es = false }: { days: AreaInsights["byDay"]; className?: string; es?: boolean }) {
  const max = Math.max(1, ...days.map((d) => d.count));
  return (
    <figure className={className} aria-label={es ? "Incidentes por día" : "Incidents per day"}>
      <div className="flex h-24 items-end gap-[3px]">
        {days.map((d) => (
          <div
            key={d.date}
            className="flex-1 rounded-t-[3px] bg-brand/80"
            style={{ height: `${Math.max(3, (d.count / max) * 100)}%`, opacity: d.count ? 1 : 0.25 }}
            title={`${d.date}: ${d.count}`}
          />
        ))}
      </div>
      <figcaption className="mt-2 flex justify-between text-[11px] text-faint tnum">
        <span>{days[0] ? new Date(`${days[0].date}T12:00:00Z`).toLocaleDateString(es ? "es-US" : undefined, { month: "short", day: "numeric" }) : ""}</span>
        <span>{es ? "hoy" : "today"}</span>
      </figcaption>
    </figure>
  );
}
