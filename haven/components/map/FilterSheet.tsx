"use client";

import { categoriesInGroup, FILTER_GROUPS, type FilterGroup } from "@/lib/categories";
import type { IncidentParams } from "@/lib/client/hooks";
import type { Viewer } from "@/lib/types";
import Link from "next/link";
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
  { value: 6, label: "6h" },
  { value: 24, label: "24h" },
  { value: 24 * 7, label: "7d" },
  { value: 24 * 30, label: "30d" },
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
  const toggleGroup = (g: FilterGroup) =>
    onChange({ ...value, groups: value.groups.includes(g) ? value.groups.filter((x) => x !== g) : [...value.groups, g] });
  const lifetime = <span className="text-[12px] font-medium text-gold">Lifetime</span>;

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Filters"
      footer={
        <div className="grid grid-cols-[auto_1fr] gap-2">
          <Button variant="secondary" size="lg" onClick={() => onChange(DEFAULT_FILTERS)}>
            Reset
          </Button>
          <Button size="lg" onClick={onClose}>
            Show incidents
          </Button>
        </div>
      }
    >
      <Label>Categories</Label>
      <div className="flex flex-wrap gap-2">
        <Chip active={value.groups.length === 0} onClick={() => onChange({ ...value, groups: [] })}>
          All
        </Chip>
        {FILTER_GROUPS.map((g) => (
          <Chip key={g.id} active={value.groups.includes(g.id)} onClick={() => toggleGroup(g.id)}>
            {g.label}
          </Chip>
        ))}
      </div>

      <div className="mt-5">
        <Label aside={maxHours < 24 * 7 ? lifetime : undefined}>Time range</Label>
        <Segmented
          label="Time range"
          value={value.sinceHours}
          onChange={(v) => onChange({ ...value, sinceHours: v })}
          options={TIME_OPTIONS.map((t) => ({ ...t, locked: t.value > maxHours }))}
        />
      </div>

      <div className="mt-5">
        <Label aside={!premium ? lifetime : undefined}>Minimum severity</Label>
        <Segmented
          label="Minimum severity"
          value={value.minSeverity}
          disabled={!premium}
          onChange={(v) => onChange({ ...value, minSeverity: v })}
          options={[
            { value: "", label: "Any" },
            { value: "moderate", label: "Moderate" },
            { value: "high", label: "High" },
            { value: "critical", label: "Critical" },
          ]}
        />
      </div>

      <div className="mt-3 divide-y divide-line">
        <Toggle checked={value.showEnded} onChange={(v) => onChange({ ...value, showEnded: v })} label="Show ended incidents" />
        <Toggle
          checked={value.verifiedOnly}
          onChange={(v) => onChange({ ...value, verifiedOnly: v })}
          label="Confirmed or official only"
          description="Hide reports nobody else has confirmed"
          disabled={!premium}
          locked={!premium}
        />
      </div>
      {!premium && (
        <p className="mb-1 pt-1 text-[13px] text-faint">
          Severity and confirmed-only filters are part of{" "}
          <Link href="/upgrade" transitionTypes={["nav-forward"]} className="font-medium text-gold">
            Haven Lifetime
          </Link>
          .
        </p>
      )}
    </Sheet>
  );
}
