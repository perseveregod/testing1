"use client";

import { useCallback, useState, useSyncExternalStore } from "react";
import { usePathname } from "next/navigation";
import { BellRing, LocateFixed, MapPinned, Navigation, ShieldCheck, Smartphone } from "lucide-react";
import { EMERGENCY_NUMBER } from "@/lib/client/defaults";
import { useLocation } from "@/components/providers/LocationProvider";
import { AppIconMark } from "@/components/brand/AppIconMark";
import { useT } from "@/lib/client/lang";
import { usePush } from "@/lib/client/push";
import { InstallSheet } from "./InstallSheet";
import { Skyline } from "@/components/houston/Skyline";

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
  { icon: MapPinned, color: "#3d8bff", title: "welcome.1.title", body: "welcome.1.body" },
  { icon: ShieldCheck, color: "#3ddc97", title: "welcome.2.title", body: "welcome.2.body" },
  { icon: LocateFixed, color: "#ff9f0a", title: "welcome.3.title", body: "welcome.3.body" },
] as const;

// Shown as a fourth screen only when this device can take push notifications
// (or can, once Haven is on the Home Screen).
const ALERT_STEP = { icon: BellRing, color: "#ff2d55", title: "welcome.alert.title", body: "welcome.alert.body" } as const;
const INSTALL_STEP = { icon: Smartphone, color: "#ff2d55", title: "welcome.install.title", body: "welcome.install.body" } as const;

export function WelcomeFlow() {
  const done = useSyncExternalStore(subscribe, seen, () => true);
  const path = usePathname();
  // Someone opening a shared incident link goes straight to it. The steps
  // (and the push status they ask the server for) only exist while showing.
  if (done || path.startsWith("/incidents/")) return null;
  return <WelcomeSteps />;
}

function WelcomeSteps() {
  const [step, setStep] = useState(0);
  const { request, status } = useLocation();

  const push = usePush();
  const [installOpen, setInstallOpen] = useState(false);
  const { t } = useT();

  const finish = useCallback(() => markSeen(), []);

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
              {t("common.skip")}
            </button>
          )}
        </div>

        <div key={step} className="haven-rise flex flex-1 flex-col justify-center">
          <span
            className="flex size-20 items-center justify-center rounded-card"
            style={{ background: `color-mix(in srgb, ${s.color} 18%, transparent)`, color: s.color }}
          >
            <Icon className="size-10" strokeWidth={1.8} aria-hidden />
          </span>
          <h1 id="welcome-title" className="mt-7 text-[32px] font-bold leading-[1.1] tracking-[-0.03em]">
            {t(s.title)}
          </h1>
          <p className="mt-3 text-[17px] leading-[1.5] text-muted">{t(s.body)}</p>
          {step === 0 && (
            <>
              <p className="mt-4 text-[14px] font-semibold text-brand">{t("welcome.houston")}</p>
              <Skyline className="mt-6 h-auto w-full text-white/[0.16]" />
            </>
          )}
          {locationStep && (
            <p className="mt-6 rounded-card bg-surface px-4 py-3 text-[14px] leading-snug text-muted">
              {t("welcome.note", { n: EMERGENCY_NUMBER })}
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
                className="press flex min-h-[54px] items-center justify-center gap-2 rounded-card bg-brand text-[16px] font-semibold text-white"
              >
                <Navigation className="size-5" aria-hidden /> {t("common.useMyLocation")}
              </button>
            )}
            <button
              onClick={() => (last ? finish() : setStep((n) => n + 1))}
              className="press flex min-h-[54px] items-center justify-center rounded-card bg-surface-2 text-[16px] font-semibold"
            >
              {status === "denied" || status === "unavailable" ? (last ? t("common.getStarted") : t("common.continue")) : t("common.maybeLater")}
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
              className="press flex min-h-[54px] items-center justify-center gap-2 rounded-card bg-live text-[16px] font-semibold text-white disabled:opacity-70"
            >
              <BellRing className="size-5" aria-hidden /> {t("welcome.turnOnAlerts")}
            </button>
            <button onClick={finish} className="press flex min-h-[54px] items-center justify-center rounded-card bg-surface-2 text-[16px] font-semibold">
              {t("common.notNow")}
            </button>
          </div>
        ) : last && extra === INSTALL_STEP ? (
          <div className="grid gap-2.5">
            <button
              onClick={() => setInstallOpen(true)}
              className="press flex min-h-[54px] items-center justify-center gap-2 rounded-card bg-text text-[16px] font-semibold text-bg"
            >
              <Smartphone className="size-5" aria-hidden /> {t("common.showMeHow")}
            </button>
            <button onClick={finish} className="press flex min-h-[54px] items-center justify-center rounded-card bg-surface-2 text-[16px] font-semibold">
              {t("common.notNow")}
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
            className="press flex min-h-[54px] items-center justify-center rounded-card bg-text text-[16px] font-semibold text-bg"
          >
            {t("common.continue")}
          </button>
        )}
      </div>
    </div>
  );
}
