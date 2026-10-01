"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff, MapPin, Radar } from "lucide-react";
import { apiSend } from "@/lib/client/api";
import { useNotifications } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { PageHeader } from "@/components/nav/PageHeader";
import { DemoNotice } from "@/components/incident/DemoNotice";
import { ButtonLink } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { RowSkeleton } from "@/components/ui/States";
import { usePlaces, useAlertPrefs } from "@/lib/client/hooks";
import { AlertSettings } from "./AlertSettings";

export function AlertsScreen() {
  const [tab, setTab] = useState<"inbox" | "settings">("inbox");
  const { items, unread, isLoading, mutate } = useNotifications();
  const { t, timeAgo, title } = useT();

  async function markAll() {
    await mutate(
      async () => {
        await apiSend("/api/notifications/read", "POST", { ids: "all" });
        return undefined;
      },
      {
        optimisticData: (cur) =>
          cur ? { items: cur.items.map((n) => ({ ...n, readAt: n.readAt ?? new Date().toISOString() })), unread: 0 } : cur!,
        revalidate: true,
      },
    );
  }

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader
        title={t("alerts.title")}
        back="/profile"
        action={
          tab === "inbox" && unread > 0 ? (
            <button onClick={markAll} className="press mr-2 min-h-11 rounded-full px-3 text-[14px] font-medium text-brand">
              {t("alerts.markAll")}
            </button>
          ) : null
        }
        sub={
          <div className="px-5 pb-3 pt-1">
            <Segmented
              label={t("alerts.section")}
              value={tab}
              onChange={setTab}
              options={[
                { value: "inbox", label: unread ? `${t("alerts.inbox")} · ${unread}` : t("alerts.inbox") },
                { value: "settings", label: t("alerts.settings") },
              ]}
            />
          </div>
        }
      />
      <div className="mx-auto max-w-lg px-4">
        {tab === "settings" ? (
          <AlertSettings />
        ) : isLoading ? (
          <div className="divide-y divide-line">
            <RowSkeleton />
            <RowSkeleton />
          </div>
        ) : items.length === 0 ? (
          <AlertsEmpty />
        ) : (
          <>
          {items.every((n) => n.isDemo) && <DemoNotice className="mb-1 mt-1" />}
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/incidents/${n.incidentId}`}
                  prefetch={false}
                  transitionTypes={["nav-forward"]}
                  onClick={() => !n.readAt && !n.isDemo && apiSend("/api/notifications/read", "POST", { ids: [n.id] }).then(() => mutate())}
                  className="-mx-4 flex items-start gap-3.5 px-4 py-4 transition active:bg-white/[0.03]"
                >
                  <CategoryIcon category={n.category} muted={Boolean(n.readAt)} />
                  <div className="min-w-0 flex-1">
                    <div className="flex items-baseline justify-between gap-3">
                      <p className={`truncate text-[15.5px] tracking-[-0.01em] ${n.readAt ? "text-muted" : "font-semibold"}`}>{title({ title: n.title, category: n.category, storm: null })}</p>
                      <span className="shrink-0 text-[13px] text-faint tnum">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className={`mt-0.5 line-clamp-2 text-[14px] leading-snug ${n.readAt ? "text-faint" : "text-muted"}`}>{n.body}</p>
                  </div>
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label={t("inc.unread")} />}
                </Link>
              </li>
            ))}
          </ul>
          </>
        )}
      </div>
    </main>
  );
}

/** Explains the chain Saved place → radius → incident → alert, and what is still missing. */
function AlertsEmpty() {
  const { places } = usePlaces();
  const { prefs } = useAlertPrefs();
  const { t } = useT();
  const hasPlace = places.length > 0;
  const on = prefs?.enabled ?? true;
  const nearMe = prefs?.nearMe ?? false;
  const covered = on && (hasPlace || nearMe);
  const steps = [
    {
      icon: MapPin,
      title: t("alerts.chooseWhere"),
      body: hasPlace ? (places.length === 1 ? t("alerts.savedPlace1") : t("alerts.savedPlaces", { n: places.length })) : nearMe ? t("alerts.currentArea") : t("alerts.chooseWhereBody"),
      done: hasPlace || nearMe,
    },
    { icon: Radar, title: t("alerts.setRadius"), body: prefs ? t("alerts.radiusAround", { n: prefs.radiusMi }) : t("alerts.radiusBody"), done: Boolean(prefs) },
    { icon: Bell, title: t("alerts.getAlerted"), body: covered ? t("alerts.getAlertedOn") : t("alerts.getAlertedOff"), done: covered },
  ];
  return (
    <div className="haven-rise pt-2">
      <div className="flex flex-col items-center px-4 pb-6 pt-8 text-center">
        <BellOff className="mb-4 size-9 text-faint" strokeWidth={1.5} aria-hidden />
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{covered ? t("alerts.nothingYet") : t("alerts.none")}</h3>
        <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-muted">{covered ? t("alerts.coveredBody") : t("alerts.setupBody")}</p>
      </div>
      <ol className="divide-y divide-line rounded-card bg-surface px-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3.5 py-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-ok/15 text-ok" : "bg-surface-3 text-muted"}`} aria-hidden>
              <s.icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium tracking-[-0.01em]">
                <span className="sr-only">{t("common.step", { n: i + 1 })}{s.done ? `, ${t("common.done")}` : ""}: </span>
                {s.title}
              </span>
              <span className="block text-[13px] leading-snug text-muted">{s.body}</span>
            </span>
          </li>
        ))}
      </ol>
      <div className="mt-4 grid gap-2">
        {!hasPlace && (
          <ButtonLink href="/profile#places" block size="lg" transitionTypes={["tab"]}>
            <MapPin className="size-[18px]" aria-hidden /> {t("alerts.addPlace")}
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
