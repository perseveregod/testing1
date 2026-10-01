"use client";

import { useState } from "react";
import Link from "next/link";
import { Bell, BellOff, MapPin, Radar } from "lucide-react";
import { apiSend } from "@/lib/client/api";
import { useNotifications } from "@/lib/client/hooks";
import { timeAgo } from "@/lib/time";
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
        title="Alerts"
        back="/profile"
        action={
          tab === "inbox" && unread > 0 ? (
            <button onClick={markAll} className="press mr-2 min-h-11 rounded-full px-3 text-[14px] font-medium text-brand">
              Mark all read
            </button>
          ) : null
        }
        sub={
          <div className="px-5 pb-3 pt-1">
            <Segmented
              label="Alerts section"
              value={tab}
              onChange={setTab}
              options={[
                { value: "inbox", label: unread ? `Inbox · ${unread}` : "Inbox" },
                { value: "settings", label: "Settings" },
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
                      <p className={`truncate text-[15.5px] tracking-[-0.01em] ${n.readAt ? "text-muted" : "font-semibold"}`}>{n.title}</p>
                      <span className="shrink-0 text-[13px] text-faint tnum">{timeAgo(n.createdAt)}</span>
                    </div>
                    <p className={`mt-0.5 line-clamp-2 text-[14px] leading-snug ${n.readAt ? "text-faint" : "text-muted"}`}>{n.body}</p>
                  </div>
                  {!n.readAt && <span className="mt-2 size-2 shrink-0 rounded-full bg-brand" aria-label="Unread" />}
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
  const hasPlace = places.length > 0;
  const on = prefs?.enabled ?? true;
  const nearMe = prefs?.nearMe ?? false;
  const covered = on && (hasPlace || nearMe);
  const steps = [
    { icon: MapPin, title: "Choose where", body: hasPlace ? `${places.length} saved ${places.length === 1 ? "place" : "places"}` : nearMe ? "Your current area" : "Save Home, Work or School, or use your current area", done: hasPlace || nearMe },
    { icon: Radar, title: "Set a radius", body: prefs ? `${prefs.radiusMi} mi around each place` : "How far around each place to watch", done: Boolean(prefs) },
    { icon: Bell, title: "Get alerted", body: covered ? "New incidents inside your radius land here." : "Alerts arrive here once a place is set.", done: covered },
  ];
  return (
    <div className="haven-rise pt-2">
      <div className="flex flex-col items-center px-4 pb-6 pt-8 text-center">
        <BellOff className="mb-4 size-9 text-faint" strokeWidth={1.5} aria-hidden />
        <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{covered ? "Nothing to report yet" : "No alerts yet"}</h3>
        <p className="mt-1.5 max-w-[300px] text-[15px] leading-relaxed text-muted">
          {covered
            ? "You're covered. When something happens inside your radius, it shows up here."
            : "Alerts only arrive for places you choose. Set one up in under a minute."}
        </p>
      </div>
      <ol className="divide-y divide-line rounded-card bg-surface px-4">
        {steps.map((s, i) => (
          <li key={s.title} className="flex items-center gap-3.5 py-3">
            <span className={`flex size-9 shrink-0 items-center justify-center rounded-full ${s.done ? "bg-ok/15 text-ok" : "bg-surface-3 text-muted"}`} aria-hidden>
              <s.icon className="size-[18px]" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block text-[15px] font-medium tracking-[-0.01em]">
                <span className="sr-only">Step {i + 1}{s.done ? ", done" : ""}: </span>
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
            <MapPin className="size-[18px]" aria-hidden /> Add a saved place
          </ButtonLink>
        )}
      </div>
    </div>
  );
}
