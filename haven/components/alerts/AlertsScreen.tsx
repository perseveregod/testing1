"use client";

import { useState } from "react";
import Link from "next/link";
import { BellOff } from "lucide-react";
import { apiSend } from "@/lib/client/api";
import { useNotifications } from "@/lib/client/hooks";
import { timeAgo } from "@/lib/time";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { PageHeader } from "@/components/nav/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";
import { EmptyState, RowSkeleton } from "@/components/ui/States";
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
        large
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
          <EmptyState
            icon={<BellOff className="size-9" strokeWidth={1.5} aria-hidden />}
            title="No alerts yet"
            body="Save a place or turn on alerts near you, and new incidents within your radius will show up here."
            action={
              <div className="flex flex-col items-center gap-2">
                <button onClick={() => setTab("settings")} className="press h-12 rounded-full bg-text px-6 text-[15px] font-semibold text-bg">
                  Set up alerts
                </button>
                <ButtonLink href="/profile#places" variant="ghost" size="sm" transitionTypes={["tab"]}>
                  Add a saved place
                </ButtonLink>
              </div>
            }
          />
        ) : (
          <ul className="divide-y divide-line">
            {items.map((n) => (
              <li key={n.id}>
                <Link
                  href={`/incidents/${n.incidentId}`}
                  transitionTypes={["nav-forward"]}
                  onClick={() => !n.readAt && apiSend("/api/notifications/read", "POST", { ids: [n.id] }).then(() => mutate())}
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
        )}
      </div>
    </main>
  );
}
