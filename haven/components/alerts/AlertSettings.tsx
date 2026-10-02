"use client";

import { useState } from "react";
import { MapPin } from "lucide-react";
import { EVERYDAY_CATEGORIES } from "@/lib/categories";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useAlertPrefs, useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { RADIUS_OPTIONS_MI } from "@/lib/plans";
import type { AlertPreferences, CategoryId } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { Chip, Group, Row, Segmented, Toggle } from "@/components/ui/Controls";
import { useAlertReadiness } from "@/lib/client/readiness";
import { AlertStatus } from "./AlertStatus";
import { Skeleton } from "@/components/ui/States";

export function AlertSettings() {
  const { prefs, mutate, isLoading } = useAlertPrefs();
  const { viewer } = useViewer();
  const { request: requestLocation } = useLocation();
  // What can really be delivered, as opposed to what is switched on below.
  const readiness = useAlertReadiness();
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
      <AlertStatus
        readiness={readiness}
        onUseArea={() => {
          requestLocation();
          save({ enabled: true, nearMe: true });
        }}
      />

      {/* These are preferences. A switch that is on with nothing behind it
          shows amber and says why; green is kept for ones that are working. */}
      <Group title={t("alerts.prefs")}>
        <Toggle
          checked={prefs.enabled}
          onChange={(v) => save({ enabled: v })}
          label={t("alerts.incident")}
          description={t("alerts.incidentBody")}
          idle={readiness.loaded && readiness.state === "setup_needed"}
          note={t("ready.masterIdle")}
        />
        <Toggle
          checked={prefs.nearMe}
          disabled={!prefs.enabled}
          onChange={(v) => {
            if (v) requestLocation();
            save({ nearMe: v });
          }}
          label={t("alerts.nearMe")}
          description={t("alerts.nearMeBody")}
          idle={readiness.nearMe === "blocked"}
          note={t("ready.nearMeIdle")}
        />
        <Toggle
          checked={prefs.savedPlaceAlerts}
          disabled={!prefs.enabled}
          onChange={(v) => save({ savedPlaceAlerts: v })}
          label={t("alerts.nearPlaces")}
          description={readiness.watchedPlaces === 1 ? t("alerts.savedPlace1") : t("alerts.savedPlaces", { n: readiness.watchedPlaces })}
          idle={readiness.placesSwitchIdle}
          note={t("ready.placesIdle")}
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
