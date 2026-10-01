"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { List, Map as MapIcon, Plus, ShieldHalf, UserRound, UsersRound, Zap } from "lucide-react";
import { useNotifications } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { useMapTone } from "@/lib/client/mapTone";
import { useAppBadge } from "@/lib/client/push";
import { requestStormReport, useStormPrefs } from "@/lib/client/stormMode";

const TABS = [
  { href: "/", label: "nav.map", icon: MapIcon },
  { href: "/feed", label: "nav.feed", icon: List },
  { href: "/report", label: "nav.report", icon: Plus, primary: true },
  { href: "/safety", label: "nav.safety", icon: ShieldHalf },
  { href: "/community", label: "nav.events", icon: UsersRound },
  { href: "/profile", label: "nav.profile", icon: UserRound },
] as const;

export function BottomNav() {
  const path = usePathname();
  const { unread } = useNotifications();
  useAppBadge(unread);
  // On the map in Storm Mode, the one big button files a storm report.
  const storm = useStormPrefs();
  const onMap = path === "/";
  const stormReport = onMap && storm.on;
  // Over the day map the bar goes light with the rest of the map chrome.
  const tone = useMapTone();
  const { t } = useT();

  return (
      <nav
        aria-label={t("nav.main")}
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
        style={{ paddingBottom: "calc(var(--safe-bottom) + var(--nav-gap))" }}
        data-tone={onMap ? tone : "dark"}
      >
        <ul className="glass pointer-events-auto mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-6 rounded-full px-1.5">
          {TABS.map((tab) => {
            const active = tab.href === "/" ? path === "/" : path.startsWith(tab.href);
            const Icon = tab.icon;
            if ("primary" in tab) {
              const cls =
                "press flex size-[50px] items-center justify-center rounded-full shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4),0_6px_18px_-6px_rgba(0,0,0,0.6)]";
              return (
                <li key={tab.href} className="flex items-center justify-center">
                  {stormReport ? (
                    <button
                      type="button"
                      onClick={requestStormReport}
                      aria-label={t("nav.reportStorm")}
                      className={`${cls} bg-[#ffc233] text-[#1b1300]`}
                    >
                      <Zap className="size-[24px] fill-current" strokeWidth={2.2} aria-hidden />
                    </button>
                  ) : (
                    <Link href={tab.href} aria-label={t("nav.reportIncident")} transitionTypes={["nav-forward"]} className={`${cls} bg-live text-white`}>
                      <Icon className="size-[26px]" strokeWidth={2.6} aria-hidden />
                    </Link>
                  )}
                </li>
              );
            }
            return (
              <li key={tab.href} className="flex items-center justify-center">
                <Link
                  href={tab.href}
                  transitionTypes={["tab"]}
                  aria-current={active ? "page" : undefined}
                  className={`press relative flex size-11 items-center justify-center rounded-full transition-colors duration-200 ${
                    active ? "text-text" : "text-muted hover:text-text"
                  }`}
                >
                  <span className="sr-only">{t(tab.label)}</span>
                  <Icon className="size-[24px]" strokeWidth={active ? 2.3 : 1.8} aria-hidden />
                  {/* Active: a small dot under the icon, like the big apps' tab bars. */}
                  <span
                    className={`absolute bottom-0.5 left-1/2 size-1 -translate-x-1/2 rounded-full bg-text transition-opacity duration-200 ${
                      active ? "opacity-100" : "opacity-0"
                    }`}
                    aria-hidden
                  />
                  {tab.href === "/profile" && unread > 0 && (
                    <span className="haven-pop absolute right-0.5 top-0.5 min-w-[17px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[17px] text-white tnum">
                      {unread > 9 ? "9+" : unread}
                      <span className="sr-only">{t("nav.unread")}</span>
                    </span>
                  )}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
  );
}
