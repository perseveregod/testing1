"use client";

import { useState } from "react";
import { Bell, BellRing, MapPin, Smartphone } from "lucide-react";
import { EVERYDAY_CATEGORIES } from "@/lib/categories";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useAlertPrefs, usePlaces, useViewer } from "@/lib/client/hooks";
import { RADIUS_OPTIONS_MI } from "@/lib/plans";
import type { AlertPreferences, CategoryId } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Chip, Group, Row, Segmented, Toggle } from "@/components/ui/Controls";
import { usePush, type PushStatus } from "@/lib/client/push";
import { InstallSheet } from "@/components/onboarding/InstallSheet";
import { Skeleton } from "@/components/ui/States";
import { Button } from "@/components/ui/Button";

export function AlertSettings() {
  const { prefs, mutate, isLoading } = useAlertPrefs();
  const { viewer } = useViewer();
  const { places } = usePlaces();
  const { request: requestLocation } = useLocation();
  const toast = useToast();
  const limits = viewer?.limits;

  async function save(patch: Partial<AlertPreferences>) {
    if (!prefs) return;
    const next = {
      ...prefs,
      ...patch,
      timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone ?? null,
    };
    try {
      await mutate(async () => apiSend<{ prefs: AlertPreferences }>("/api/alerts/preferences", "PUT", next), {
        optimisticData: { prefs: next },
        rollbackOnError: true,
        revalidate: false,
      });
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  if (isLoading || !prefs || !limits) {
    return (
      <div className="space-y-3 pt-4" aria-busy>
        <Skeleton className="h-28 w-full rounded-card" />
        <Skeleton className="h-40 w-full rounded-card" />
      </div>
    );
  }

  const allCats = prefs.categories.length === 0;
  const toggleCat = (c: CategoryId) => {
    const current = allCats ? EVERYDAY_CATEGORIES.map((x) => x.id) : prefs.categories;
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    save({ categories: next.length === EVERYDAY_CATEGORIES.length ? [] : next });
  };
  const free = viewer.plan === "free";

  return (
    <div className="pb-4">
      <BrowserNotifications />

      <Group>
        <Toggle checked={prefs.enabled} onChange={(v) => save({ enabled: v })} label="Incident alerts" description="New incidents in your area" />
        <Toggle
          checked={prefs.nearMe}
          disabled={!prefs.enabled}
          onChange={(v) => {
            if (v) requestLocation();
            save({ nearMe: v });
          }}
          label="Near my current location"
          description="Shares an approximate (~1 km) location while on. Turning it off deletes it."
        />
        <Toggle
          checked={prefs.savedPlaceAlerts}
          disabled={!prefs.enabled}
          onChange={(v) => save({ savedPlaceAlerts: v })}
          label="Near my saved places"
          description={places.length ? `${places.length} saved ${places.length === 1 ? "place" : "places"}` : "No saved places yet"}
        />
        <Toggle
          checked={prefs.criticalOnly}
          disabled={!prefs.enabled}
          onChange={(v) => save({ criticalOnly: v })}
          label="Critical only"
          description="Major fires, evacuations, severe weather warnings"
        />
      </Group>

      <Group
        title="Alert radius"
        footer={
          free && (
            <>
              Free covers up to {limits.maxAlertRadiusMi} miles.{" "}
              <a href="/upgrade" className="text-gold">
                Lifetime goes to 25.
              </a>
            </>
          )
        }
      >
        <div className="py-3.5">
          <Segmented
            label="Alert radius"
            value={prefs.radiusMi}
            disabled={!prefs.enabled}
            onChange={(v) => save({ radiusMi: v })}
            options={RADIUS_OPTIONS_MI.map((r) => ({ value: r, label: `${r} mi`, locked: r > limits.maxAlertRadiusMi }))}
          />
        </div>
      </Group>

      <Group title="Categories">
        <div className="flex flex-wrap gap-2 py-3.5">
          <Chip active={allCats} onClick={() => save({ categories: [] })} disabled={!prefs.enabled}>
            All
          </Chip>
          {EVERYDAY_CATEGORIES.map((c) => (
            <Chip key={c.id} active={!allCats && prefs.categories.includes(c.id)} onClick={() => toggleCat(c.id)} disabled={!prefs.enabled}>
              {c.short}
            </Chip>
          ))}
        </div>
      </Group>

      <QuietHours prefs={prefs} allowed={limits.quietHours} onSave={save} />

      <Group>
        <Row icon={<MapPin className="size-5" />} title="Saved places" detail="Home, Work, School and more" href="/profile#places" />
      </Group>
    </div>
  );
}

function QuietHours({ prefs, allowed, onSave }: { prefs: AlertPreferences; allowed: boolean; onSave: (p: Partial<AlertPreferences>) => void }) {
  const on = Boolean(prefs.quietHoursStart && prefs.quietHoursEnd);
  const [start, setStart] = useState(prefs.quietHoursStart ?? "22:00");
  const [end, setEnd] = useState(prefs.quietHoursEnd ?? "07:00");

  return (
    <Group title="Quiet hours" footer={!allowed ? "Part of Haven Lifetime." : undefined}>
      <Toggle
        checked={on}
        locked={!allowed}
        disabled={!allowed || !prefs.enabled}
        onChange={(v) => onSave(v ? { quietHoursStart: start, quietHoursEnd: end } : { quietHoursStart: null, quietHoursEnd: null })}
        label="Only critical alerts overnight"
        description="Everything else waits in your inbox"
      />
      {on && (
        <div className="grid grid-cols-2 gap-3 py-3.5">
          {(
            [
              ["From", start, setStart, "quietHoursStart"],
              ["Until", end, setEnd, "quietHoursEnd"],
            ] as const
          ).map(([label, value, set, key]) => (
            <label key={key} className="block">
              <span className="text-[12.5px] text-muted">{label}</span>
              <input
                type="time"
                value={value}
                onChange={(e) => set(e.target.value)}
                onBlur={(e) => e.target.value && onSave({ [key]: e.target.value })}
                className="mt-1 h-11 w-full rounded-xl bg-surface-2 px-3 text-[16px] outline-none ring-brand/60 focus:ring-2 tnum"
              />
            </label>
          ))}
        </div>
      )}
    </Group>
  );
}

function BrowserNotifications() {
  const push = usePush();
  const toast = useToast();
  const [installOpen, setInstallOpen] = useState(false);
  if (push.status === "loading") return null;

  const copy: Record<Exclude<PushStatus, "loading">, { title: string; body: string }> = {
    on: { title: "Push notifications are on", body: `Alerts reach this device even when Haven is closed.${push.devices > 1 ? ` ${push.devices} devices in total.` : ""}` },
    off: { title: "Push notifications", body: "Get alerts on this device even when Haven is closed. Only incidents near your places, nothing else." },
    install: { title: "Add Haven to your Home Screen", body: "On iPhone, notifications only work from the Home Screen. Takes ten seconds." },
    setup: { title: "Push is being set up", body: "Alerts show in this inbox for now. Device notifications switch on once the push keys are configured." },
    denied: { title: "Notifications are blocked", body: "You said no in the browser prompt. To change it: Settings › Haven › Notifications. Alerts still land in this inbox." },
    unsupported: { title: "Device notifications", body: "This browser can't show notifications. Alerts still land in this inbox." },
  };
  const c = copy[push.status];

  return (
    <div className="mt-4 flex items-start gap-3 rounded-card bg-surface p-4">
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${push.status === "on" ? "bg-ok/15 text-ok" : "bg-brand/15 text-brand"}`}>
        {push.status === "on" ? <BellRing className="size-[18px]" aria-hidden /> : push.status === "install" ? <Smartphone className="size-[18px]" aria-hidden /> : <Bell className="size-[18px]" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">{c.title}</p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-muted">{c.body}</p>
        {push.error && <p className="mt-1 text-[13px] text-danger">{push.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {push.status === "off" && (
            <Button size="sm" onClick={push.enable} loading={push.busy}>
              Turn on
            </Button>
          )}
          {push.status === "on" && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const n = await push.sendTest().catch(() => 0);
                  toast(n > 0 ? "Sent. It should arrive in a moment." : "Nothing sent. Try turning push off and on.", n > 0 ? "success" : "error");
                }}
              >
                Send a test
              </Button>
              <Button size="sm" variant="ghost" onClick={push.disable} loading={push.busy}>
                Turn off on this device
              </Button>
            </>
          )}
          {push.status === "install" && (
            <Button size="sm" onClick={() => setInstallOpen(true)}>
              Show me how
            </Button>
          )}
        </div>
      </div>
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
