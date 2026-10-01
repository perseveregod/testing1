"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BellRing, LocateFixed, MapPinned, Navigation, ShieldCheck, Smartphone } from "lucide-react";
import { EMERGENCY_NUMBER } from "@/lib/client/defaults";
import { useLocation } from "@/components/providers/LocationProvider";
import { AppIconMark } from "@/components/brand/AppIconMark";
import { usePush } from "@/lib/client/push";
import { InstallSheet } from "./InstallSheet";

// First-run welcome: three short screens, shown once per device.

const KEY = "haven.welcomed.v1";
const listeners = new Set<() => void>();

function seen(): boolean {
  try {
    return localStorage.getItem(KEY) === "1";
  } catch {
    // Storage blocked (private mode): don't trap people in the welcome.
    return true;
  }
}

function markSeen() {
  try {
    localStorage.setItem(KEY, "1");
  } catch {
    // Ignore; the welcome just won't be remembered.
  }
  listeners.forEach((l) => l());
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

const STEPS = [
  {
    icon: MapPinned,
    color: "#3d8bff",
    title: "Know what's happening around you",
    body: "A live map of Houston fire, EMS and police dispatches, plus what neighbors report. Updated every few minutes.",
  },
  {
    icon: ShieldCheck,
    color: "#3ddc97",
    title: "Report what you see, safely",
    body: "Share from a safe distance. Haven shows only the block, never your exact spot, and removes names and personal details.",
  },
  {
    icon: LocateFixed,
    color: "#ff9f0a",
    title: "See what's near you",
    body: "Allow location to see distances and what's closest. It stays on your device; Haven only uses it to sort and alert.",
  },
] as const;

// Shown as a fourth screen only when this device can take push notifications
// (or can, once Haven is on the Home Screen).
const ALERT_STEP = {
  icon: BellRing,
  color: "#ff2d55",
  title: "Hear about it first",
  body: "Alerts for incidents near your places, even when Haven is closed. Only what's near you, never a feed of everything.",
} as const;
const INSTALL_STEP = {
  icon: Smartphone,
  color: "#ff2d55",
  title: "Put Haven on your Home Screen",
  body: "Full screen, faster, and the only way iPhone lets a web app notify you. Ten seconds, from the Share button.",
} as const;

export function WelcomeFlow() {
  const done = useSyncExternalStore(subscribe, seen, () => true);
  const [step, setStep] = useState(0);
  const { request, status } = useLocation();
  const path = usePathname();

  const push = usePush();
  const [installOpen, setInstallOpen] = useState(false);

  const finish = useCallback(() => markSeen(), []);

  // Someone opening a shared incident link goes straight to it.
  if (done || path.startsWith("/incidents/")) return null;
  const extra = push.status === "off" ? ALERT_STEP : push.status === "install" ? INSTALL_STEP : null;
  const steps = extra ? [...STEPS, extra] : STEPS;
  const s = steps[Math.min(step, steps.length - 1)]!;
  const Icon = s.icon;
  const locationStep = step === STEPS.length - 1;
  const last = step === steps.length - 1;

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="welcome-title"
      data-push={push.status}
      className="haven-fade-in fixed inset-0 z-[80] flex flex-col bg-bg"
      style={{ paddingTop: "calc(var(--safe-top) + 16px)", paddingBottom: "calc(var(--safe-bottom) + 20px)" }}
    >
      <div className="relative mx-auto flex w-full max-w-md flex-1 flex-col px-6">
        <div className="flex items-center justify-between">
          <AppIconMark className="size-9" />
          {!last && (
            <button onClick={finish} className="press min-h-11 rounded-full px-3 text-[15px] font-medium text-muted">
              Skip
            </button>
          )}
        </div>

        <div key={step} className="haven-rise flex flex-1 flex-col justify-center">
          <span
            className="flex size-20 items-center justify-center rounded-[24px]"
            style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}
          >
            <Icon className="size-10" strokeWidth={1.8} aria-hidden />
          </span>
          <h1 id="welcome-title" className="mt-7 text-[32px] font-bold leading-[1.1] tracking-[-0.03em]">
            {s.title}
          </h1>
          <p className="mt-3 text-[17px] leading-[1.5] text-muted">{s.body}</p>
          {locationStep && (
            <p className="mt-6 rounded-[16px] bg-surface px-4 py-3 text-[14px] leading-snug text-muted">
              Haven doesn&apos;t contact emergency services. If someone is in danger, call {EMERGENCY_NUMBER}.
            </p>
          )}
        </div>

        <div className="mb-5 flex justify-center gap-2" aria-hidden>
          {steps.map((_, i) => (
            <span
              key={i}
              className={`h-2 rounded-full transition-all duration-300 ${i === step ? "w-6 bg-text" : "w-2 bg-white/25"}`}
            />
          ))}
        </div>

        {locationStep ? (
          <div className="grid gap-2.5">
            {status !== "denied" && status !== "unavailable" && (
              <button
                onClick={() => {
                  request();
                  if (last) finish();
                  else setStep((n) => n + 1);
                }}
                className="press flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-brand text-[16px] font-semibold text-white"
              >
                <Navigation className="size-5" aria-hidden /> Use my location
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setStep((n) => n + 1))}
              className="press flex min-h-[54px] items-center justify-center rounded-2xl bg-surface-2 text-[16px] font-semibold"
            >
              {status === "denied" || status === "unavailable" ? (last ? "Get started" : "Continue") : "Maybe later"}
            </button>
          </div>
        ) : last && extra === ALERT_STEP ? (
          <div className="grid gap-2.5">
            <button
              onClick={async () => {
                await push.enable();
                finish();
              }}
              disabled={push.busy}
              className="press flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-live text-[16px] font-semibold text-white disabled:opacity-70"
            >
              <BellRing className="size-5" aria-hidden /> Turn on alerts
            </button>
            <button onClick={finish} className="press flex min-h-[54px] items-center justify-center rounded-2xl bg-surface-2 text-[16px] font-semibold">
              Not now
            </button>
          </div>
        ) : last && extra === INSTALL_STEP ? (
          <div className="grid gap-2.5">
            <button
              onClick={() => setInstallOpen(true)}
              className="press flex min-h-[54px] items-center justify-center gap-2 rounded-2xl bg-text text-[16px] font-semibold text-bg"
            >
              <Smartphone className="size-5" aria-hidden /> Show me how
            </button>
            <button onClick={finish} className="press flex min-h-[54px] items-center justify-center rounded-2xl bg-surface-2 text-[16px] font-semibold">
              Not now
            </button>
            <InstallSheet
              open={installOpen}
              onClose={() => {
                setInstallOpen(false);
                finish();
              }}
            />
          </div>
        ) : (
          <button
            onClick={() => setStep((n) => n + 1)}
            className="press flex min-h-[54px] items-center justify-center rounded-2xl bg-text text-[16px] font-semibold text-bg"
          >
            Continue
          </button>
        )}
      </div>
    </div>
  );
}
