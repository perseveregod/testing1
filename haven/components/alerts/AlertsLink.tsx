"use client";

import Link from "next/link";
import { Bell } from "lucide-react";
import { useNotifications } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { useAlertReadiness } from "@/lib/client/readiness";

/**
 * A bell that opens Alerts from a main tab. Its dot is honest about setup:
 * amber while alerts can't reach this device yet, red for unread ones.
 */
export function AlertsLink() {
  const { t } = useT();
  const { unread } = useNotifications();
  const r = useAlertReadiness();
  const needsSetup = r.loaded && (r.state === "setup_needed" || r.state === "inbox_only" || r.state === "push_untested");
  const label = unread > 0 ? `${t("alerts.open")} (${unread})` : needsSetup ? t("alerts.openSetup") : t("alerts.open");
  return (
    <Link
      href="/alerts"
      transitionTypes={["nav-forward"]}
      aria-label={label}
      title={label}
      className="press relative mr-1 inline-flex size-11 items-center justify-center rounded-full text-text hover:bg-surface-2"
    >
      <Bell className="size-[21px]" aria-hidden />
      {(unread > 0 || needsSetup) && (
        <span className={`absolute right-2 top-2 size-2.5 rounded-full ring-2 ring-bg ${unread > 0 ? "bg-danger" : "bg-warn"}`} aria-hidden />
      )}
    </Link>
  );
}
