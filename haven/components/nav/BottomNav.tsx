"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { ViewTransition } from "react";
import { Bell, List, Map as MapIcon, Plus, UserRound } from "lucide-react";
import { useNotifications } from "@/lib/client/hooks";

const TABS = [
  { href: "/", label: "Map", icon: MapIcon },
  { href: "/feed", label: "Feed", icon: List },
  { href: "/report", label: "Report", icon: Plus, primary: true },
  { href: "/alerts", label: "Alerts", icon: Bell },
  { href: "/profile", label: "Profile", icon: UserRound },
] as const;

export function BottomNav() {
  const path = usePathname();
  const { unread } = useNotifications();
  return (
    <ViewTransition name="tab-bar" default="none" share="none">
      <nav
        aria-label="Main"
        className="fixed inset-x-0 bottom-0 z-40 bg-bg/80 shadow-[inset_0_1px_0_var(--line)] backdrop-blur-2xl backdrop-saturate-150"
        style={{ paddingBottom: "var(--safe-bottom)" }}
      >
        <ul className="mx-auto grid h-[var(--nav-h)] max-w-lg grid-cols-5">
          {TABS.map((t) => {
            const active =
              t.href === "/" ? path === "/" : path.startsWith(t.href);
            const Icon = t.icon;
            if ("primary" in t) {
              return (
                <li key={t.href} className="flex items-center justify-center">
                  <Link
                    href={t.href}
                    aria-label="Report an incident"
                    transitionTypes={["nav-forward"]}
                    className="press flex h-10 w-14 items-center justify-center rounded-full bg-text text-bg"
                  >
                    <Icon
                      className="size-[22px]"
                      strokeWidth={2.4}
                      aria-hidden
                    />
                  </Link>
                </li>
              );
            }
            return (
              <li key={t.href}>
                <Link
                  href={t.href}
                  transitionTypes={["tab"]}
                  aria-current={active ? "page" : undefined}
                  className={`flex h-full flex-col items-center justify-center gap-[3px] text-[10.5px] font-medium tracking-[0.01em] transition-colors duration-200 ${
                    active ? "text-text" : "text-faint hover:text-muted"
                  }`}
                >
                  <span className="relative">
                    <Icon
                      className={`size-[23px] transition-transform duration-300 ease-[var(--ease-spring)] ${active ? "scale-105" : ""}`}
                      strokeWidth={active ? 2.2 : 1.8}
                      aria-hidden
                    />
                    {t.href === "/alerts" && unread > 0 && (
                      <span className="haven-pop absolute -right-2 -top-1 min-w-[17px] rounded-full bg-danger px-1 text-center text-[10px] font-bold leading-[17px] text-white tnum ring-2 ring-bg">
                        {unread > 9 ? "9+" : unread}
                        <span className="sr-only"> unread alerts</span>
                      </span>
                    )}
                  </span>
                  {t.label}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>
    </ViewTransition>
  );
}
