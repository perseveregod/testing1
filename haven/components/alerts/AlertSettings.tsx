"use client";

import { useState } from "react";
import { Bell, BellRing, MapPin, Smartphone } from "lucide-react";
import { EVERYDAY_CATEGORIES } from "@/lib/categories";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useAlertPrefs, usePlaces, useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
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
  const { t, cat } = useT();
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
        <Toggle checked={prefs.enabled} onChange={(v) => save({ enabled: v })} label={t("alerts.incident")} description={t("alerts.incidentBody")} />
        <Toggle
          checked={prefs.nearMe}
          disabled={!prefs.enabled}
          onChange={(v) => {
            if (v) requestLocation();
            save({ nearMe: v });
          }}
          label={t("alerts.nearMe")}
          description={t("alerts.nearMeBody")}
        />
        <Toggle
          checked={prefs.savedPlaceAlerts}
          disabled={!prefs.enabled}
          onChange={(v) => save({ savedPlaceAlerts: v })}
          label={t("alerts.nearPlaces")}
          description={places.length ? (places.length === 1 ? t("alerts.savedPlace1") : t("alerts.savedPlaces", { n: places.length })) : t("alerts.noPlaces")}
        />
        <Toggle
          checked={prefs.criticalOnly}
          disabled={!prefs.enabled}
          onChange={(v) => save({ criticalOnly: v })}
          label={t("alerts.criticalOnly")}
          description={t("alerts.criticalOnlyBody")}
        />
      </Group>

      <Group
        title={t("alerts.radius")}
        footer={free ? t("alerts.freeRadius", { n: limits.maxAlertRadiusMi }).trim() : undefined}
      >
        <div className="py-3.5">
          <Segmented
            label={t("alerts.radius")}
            value={prefs.radiusMi}
            disabled={!prefs.enabled}
            onChange={(v) => save({ radiusMi: v })}
            options={RADIUS_OPTIONS_MI.map((r) => ({ value: r, label: `${r} mi`, locked: r > limits.maxAlertRadiusMi }))}
          />
        </div>
      </Group>

      <Group title={t("alerts.categories")}>
        <div className="flex flex-wrap gap-2 py-3.5">
          <Chip active={allCats} onClick={() => save({ categories: [] })} disabled={!prefs.enabled}>
            {t("common.all")}
          </Chip>
          {EVERYDAY_CATEGORIES.map((c) => (
            <Chip key={c.id} active={!allCats && prefs.categories.includes(c.id)} onClick={() => toggleCat(c.id)} disabled={!prefs.enabled}>
              {cat(c.id).short}
            </Chip>
          ))}
        </div>
      </Group>

      <QuietHours prefs={prefs} allowed={limits.quietHours} onSave={save} />

      <Group>
        <Row icon={<MapPin className="size-5" />} title={t("alerts.places")} detail={t("alerts.placesBody")} href="/profile#places" />
      </Group>
    </div>
  );
}

function QuietHours({ prefs, allowed, onSave }: { prefs: AlertPreferences; allowed: boolean; onSave: (p: Partial<AlertPreferences>) => void }) {
  const on = Boolean(prefs.quietHoursStart && prefs.quietHoursEnd);
  const [start, setStart] = useState(prefs.quietHoursStart ?? "22:00");
  const [end, setEnd] = useState(prefs.quietHoursEnd ?? "07:00");
  const { t } = useT();

  return (
    <Group title={t("alerts.quiet")}>
      <Toggle
        checked={on}
        locked={!allowed}
        disabled={!allowed || !prefs.enabled}
        onChange={(v) => onSave(v ? { quietHoursStart: start, quietHoursEnd: end } : { quietHoursStart: null, quietHoursEnd: null })}
        label={t("alerts.quietLabel")}
        description={t("alerts.quietBody")}
      />
      {on && (
        <div className="grid grid-cols-2 gap-3 py-3.5">
          {(
            [
              [t("alerts.from"), start, setStart, "quietHoursStart"],
              [t("alerts.until"), end, setEnd, "quietHoursEnd"],
            ] as const
          ).map(([label, value, set, key]) => (
            <label key={key} className="block">
              <span className="text-[12px] text-muted">{label}</span>
              <input
                type="time"
                value={value}
                onChange={(e) => set(e.target.value)}
                onBlur={(e) => e.target.value && onSave({ [key]: e.target.value })}
                className="mt-1 h-11 w-full rounded-control bg-surface-2 px-3 text-[16px] outline-none ring-brand/60 focus:ring-2 tnum"
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
  const { t } = useT();
  const [installOpen, setInstallOpen] = useState(false);
  if (push.status === "loading") return null;

  const copy: Record<Exclude<PushStatus, "loading">, { title: string; body: string }> = {
    on: { title: t("push.on"), body: `${t("push.onBody")}${push.devices > 1 ? t("push.devices", { n: push.devices }) : ""}` },
    off: { title: t("push.off"), body: t("push.offBody") },
    install: { title: t("push.install"), body: t("push.installBody") },
    setup: { title: t("push.setup"), body: t("push.setupBody") },
    denied: { title: t("push.denied"), body: t("push.deniedBody") },
    unsupported: { title: t("push.unsupported"), body: t("push.unsupportedBody") },
  };
  const c = copy[push.status];

  return (
    <div className="mt-4 flex items-start gap-3 rounded-card bg-surface p-4">
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${push.status === "on" ? "bg-ok/15 text-ok" : "bg-brand/15 text-brand"}`}>
        {push.status === "on" ? <BellRing className="size-[18px]" aria-hidden /> : push.status === "install" ? <Smartphone className="size-[18px]" aria-hidden /> : <Bell className="size-[18px]" aria-hidden />}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">{c.title}</p>
        <p className="mt-0.5 text-[13px] leading-snug text-muted">{c.body}</p>
        {push.error && <p className="mt-1 text-[13px] text-danger">{push.error}</p>}
        <div className="mt-3 flex flex-wrap gap-2">
          {push.status === "off" && (
            <Button size="sm" onClick={push.enable} loading={push.busy}>
              {t("common.turnOn")}
            </Button>
          )}
          {push.status === "on" && (
            <>
              <Button
                size="sm"
                variant="secondary"
                onClick={async () => {
                  const n = await push.sendTest().catch(() => 0);
                  toast(n > 0 ? t("push.testSent") : t("push.testFailed"), n > 0 ? "success" : "error");
                }}
              >
                {t("push.sendTest")}
              </Button>
              <Button size="sm" variant="ghost" onClick={push.disable} loading={push.busy}>
                {t("push.turnOffDevice")}
              </Button>
            </>
          )}
          {push.status === "install" && (
            <Button size="sm" onClick={() => setInstallOpen(true)}>
              {t("common.showMeHow")}
            </Button>
          )}
        </div>
      </div>
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </div>
  );
}
