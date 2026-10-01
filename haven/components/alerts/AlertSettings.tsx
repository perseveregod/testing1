"use client";

import { useEffect, useState } from "react";
import { BellRing, MapPin } from "lucide-react";
import { CATEGORIES } from "@/lib/categories";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useAlertPrefs, usePlaces, useViewer } from "@/lib/client/hooks";
import { RADIUS_OPTIONS_MI } from "@/lib/plans";
import type { AlertPreferences, CategoryId } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Chip, Group, Row, Segmented, Toggle } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/States";

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
        <Skeleton className="h-28 w-full rounded-[18px]" />
        <Skeleton className="h-40 w-full rounded-[18px]" />
      </div>
    );
  }

  const allCats = prefs.categories.length === 0;
  const toggleCat = (c: CategoryId) => {
    const current = allCats ? CATEGORIES.map((x) => x.id) : prefs.categories;
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    save({ categories: next.length === CATEGORIES.length ? [] : next });
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
          {CATEGORIES.map((c) => (
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
  const [perm, setPerm] = useState<NotificationPermission | "unsupported" | null>(null);
  useEffect(() => {
    queueMicrotask(() => setPerm(typeof Notification === "undefined" ? "unsupported" : Notification.permission));
  }, []);
  if (perm === null || perm === "granted") return null;
  return (
    <div className="mt-4 flex items-start gap-3 rounded-[18px] bg-surface p-4">
      <BellRing className="mt-0.5 size-5 shrink-0 text-brand" aria-hidden />
      <div className="flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">Device notifications</p>
        <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
          {perm === "unsupported"
            ? "This browser can't show notifications. On iPhone, add Haven to your Home Screen first."
            : perm === "denied"
              ? "Notifications are blocked for this site. You'll still see alerts in your inbox."
              : "Get a heads-up on this device when an alert arrives while Haven is open in the background."}
        </p>
        {perm === "default" && (
          <button onClick={async () => setPerm(await Notification.requestPermission())} className="press mt-3 h-10 rounded-full bg-text px-4 text-[14px] font-semibold text-bg">
            Turn on
          </button>
        )}
      </div>
    </div>
  );
}
