"use client";

import { categoriesInGroup, FILTER_GROUPS, type FilterGroup } from "@/lib/categories";
import type { IncidentParams } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import type { Viewer } from "@/lib/types";
import { Button } from "@/components/ui/Button";
import { Chip, Segmented, Toggle } from "@/components/ui/Controls";
import { Sheet } from "@/components/ui/Sheet";

export interface MapFilters {
  groups: FilterGroup[];
  showEnded: boolean;
  sinceHours: number;
  minSeverity: "" | "moderate" | "high" | "critical";
  verifiedOnly: boolean;
}

export const DEFAULT_FILTERS: MapFilters = {
  groups: [],
  showEnded: true,
  sinceHours: 24,
  minSeverity: "",
  verifiedOnly: false,
};

export function activeFilterCount(f: MapFilters) {
  return (
    f.groups.length +
    (f.showEnded ? 0 : 1) +
    (f.sinceHours !== 24 ? 1 : 0) +
    (f.minSeverity ? 1 : 0) +
    (f.verifiedOnly ? 1 : 0)
  );
}

/** Turns UI filters into API query params, dropping anything the plan doesn't allow. */
export function filterParams(f: MapFilters, viewer: Viewer | null): Partial<IncidentParams> {
  const premium = viewer?.limits.advancedFilters ?? false;
  return {
    categories: f.groups.flatMap(categoriesInGroup),
    includeResolved: f.showEnded,
    sinceHours: Math.min(f.sinceHours, viewer?.limits.historyHours ?? 24),
    minSeverity: premium && f.minSeverity ? f.minSeverity : undefined,
    verifiedOnly: premium && f.verifiedOnly,
  };
}

const TIME_OPTIONS = [
  { value: 6, hours: 6 },
  { value: 24, hours: 24 },
  { value: 24 * 7, days: 7 },
  { value: 24 * 30, days: 30 },
];

function Label({ children, aside }: { children: React.ReactNode; aside?: React.ReactNode }) {
  return (
    <div className="mb-2.5 flex items-center justify-between">
      <p className="text-[13px] font-medium text-muted">{children}</p>
      {aside}
    </div>
  );
}

export function FilterSheet({
  open,
  onClose,
  value,
  onChange,
  viewer,
}: {
  open: boolean;
  onClose: () => void;
  value: MapFilters;
  onChange: (f: MapFilters) => void;
  viewer: Viewer | null;
}) {
  const premium = viewer?.limits.advancedFilters ?? false;
  const maxHours = viewer?.limits.historyHours ?? 24;
  const { t, es } = useT();
  const toggleGroup = (g: FilterGroup) =>
    onChange({ ...value, groups: value.groups.includes(g) ? value.groups.filter((x) => x !== g) : [...value.groups, g] });

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("filter.title")}
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" size="lg" onClick={() => onChange(DEFAULT_FILTERS)}>
            {es ? "Restablecer" : "Reset"}
          </Button>
          <Button size="lg" onClick={onClose}>
            {es ? "Listo" : "Done"}
          </Button>
        </div>
      }
    >
      <Label>{t("filter.categories")}</Label>
      <div className="flex flex-wrap gap-2">
        <Chip active={value.groups.length === 0} onClick={() => onChange({ ...value, groups: [] })}>
          {t("common.all")}
        </Chip>
        {FILTER_GROUPS.map((g) => (
          <Chip key={g.id} active={value.groups.includes(g.id)} onClick={() => toggleGroup(g.id)}>
            {es ? g.labelEs : g.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        <Label>{t("filter.time")}</Label>
        <Segmented
          label={t("filter.time")}
          value={value.sinceHours}
          onChange={(v) => onChange({ ...value, sinceHours: v })}
          options={TIME_OPTIONS.map((o) => ({
            value: o.value,
            label: o.days ? t("filter.days", { n: o.days }) : t("filter.hours", { n: o.hours ?? 0 }),
            locked: o.value > maxHours,
          }))}
        />
      </div>

      <div className="mt-5">
        <Label>{t("filter.severity")}</Label>
        <Segmented
          label={t("filter.severity")}
          value={value.minSeverity}
          disabled={!premium}
          onChange={(v) => onChange({ ...value, minSeverity: v })}
          options={[
            { value: "", label: t("common.any") },
            { value: "moderate", label: t("inc.sev.moderate") },
            { value: "high", label: t("inc.sev.high") },
            { value: "critical", label: t("inc.sev.critical") },
          ]}
        />
      </div>

      <div className="mt-3 divide-y divide-line">
        <Toggle checked={value.showEnded} onChange={(v) => onChange({ ...value, showEnded: v })} label={t("filter.showEnded")} />
        <Toggle
          checked={value.verifiedOnly}
          onChange={(v) => onChange({ ...value, verifiedOnly: v })}
          label={t("filter.confirmedOnly")}
          description={t("filter.confirmedOnlyBody")}
          disabled={!premium}
          locked={!premium}
        />
      </div>
    </Sheet>
  );
}
