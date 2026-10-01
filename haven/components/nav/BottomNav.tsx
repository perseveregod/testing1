"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { List, Map as MapIcon, Plus, ShieldHalf, UserRound, UsersRound, Zap } from "lucide-react";
import { requestStormReport, useStormPrefs } from "@/lib/client/stormMode";
import { useNotifications } from "@/lib/client/hooks";

const TABS = [
  { href: "/", label: "Map", icon: MapIcon },
  { href: "/feed", label: "Feed", icon: List },
  { href: "/report", label: "Report", icon: Plus, primary: true },
  { href: "/safety", label: "Safety", icon: ShieldHalf },
  { href: "/community", label: "Events", icon: UsersRound },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

export function BottomNav() {
  const path = usePathname();
  const { unread } = useNotifications();
  // On the map in Storm Mode, the one big button files a storm report.
  const storm = useStormPrefs();
  const stormReport = path === "/" && storm.on;
  return (
    <ViewTransition name="tab-bar" default="none" share="none">
      <nav
        aria-label="Main"
        className="pointer-events-none fixed inset-x-0 bottom-0 z-40 px-3"
        style={{ paddingBottom: "calc(var(--safe-bottom) + var(--nav-gap))" }}
      >
        {/* A floating Liquid Glass capsule, like the iOS 26 tab bar. */}
        <ul className="glass pointer-events-auto mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-6 rounded-full px-1">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? path === "/" : path.startsWith(t.href);
            const Icon = t.icon;
            if ("primary" in t) {
              const cls = "press -mt-6 flex size-[60px] items-center justify-center rounded-full shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.4),0_8px_24px_-6px_rgba(0,0,0,0.6)]";
              return (
                <li key={t.href} className="flex items-center justify-center">
                  {stormReport ? (
                    <button
                      type="button"
                      onClick={requestStormReport}
                      aria-label={storm.lang === "es" ? "Reportar luz, inundación o lugar abierto" : "Report power, flooding or an open place"}
                      className={`${cls} bg-[#ffc233] text-[#1b1300]`}
                    >
                      <Zap className="size-[26px] fill-current" strokeWidth={2.2} aria-hidden />
                    </button>
                  ) : (
                    <Link href={t.href} aria-label="Report an incident" transitionTypes={["nav-forward"]} className={`${cls} bg-live text-white`}>
                      <Icon className="size-[28px]" strokeWidth={2.6} aria-hidden />
                    </Link>
                  )}
                </li>
              );
            }
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  transitionTypes={["tab"]}
                  aria-current={active ? "page" : undefined}
                  className={`mx-0.5 my-1 flex h-[calc(100%-8px)] flex-col items-center justify-center rounded-full transition-[color,background-color] duration-300 ${
                    active
                      ? "bg-white/[0.13] text-text shadow-[inset_0_1px_0.5px_rgba(255,255,255,0.3),inset_0_0_0_0.5px_rgba(255,255,255,0.08)]"
                      : "text-muted hover:text-text"
                  }`}
                >
                  <span className="sr-only">{t.label}</span>
                  <span className="relative">
                    <Icon
                      className={`size-[24px] transition-transform duration-300 ease-[var(--ease-spring)] ${active ? "scale-105" : ""}`}
                      strokeWidth={active ? 2.2 : 1.8}
                      aria-hidden
                    />
                    {t.href === "/profile" && unread > 0 && (
                      <span className="haven-pop absolute -right-2 -top-1 min-w-[17px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[17px] text-white tnum ring-2 ring-bg">
                        {unread > 9 ? "9+" : unread}
                        <span className="sr-only"> unread alerts</span>
                      </span>
                    )}
                  </span>
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </ViewTransition>
  );
}
