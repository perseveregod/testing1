import type { CategoryId, Severity } from "./types";

export type FilterGroup = "police" | "fire" | "medical" | "traffic" | "weather" | "other" | "storm";

export interface CategoryDef {
  id: CategoryId;
  label: string;
  short: string;
  /** Marker / accent color. Chosen to stay legible on the dark map. */
  color: string;
  group: FilterGroup;
  defaultSeverity: Severity;
  /** After this long with no activity, an active incident reads as ended. */
  staleAfterHours: number;
  /** Reports within this distance and window are treated as the same event. */
  dedupeRadiusM: number;
  dedupeWindowMin: number;
  hint: string;
}

export const CATEGORIES: readonly CategoryDef[] = [
  {
    id: "police",
    label: "Police Activity",
    short: "Police",
    color: "#6E8BFF",
    group: "police",
    defaultSeverity: "moderate",
    staleAfterHours: 3,
    dedupeRadiusM: 300,
    dedupeWindowMin: 90,
    hint: "Officers or vehicles responding, roads blocked by police",
  },
  {
    id: "fire",
    label: "Fire",
    short: "Fire",
    color: "#FF7A45",
    group: "fire",
    defaultSeverity: "high",
    staleAfterHours: 4,
    dedupeRadiusM: 500,
    dedupeWindowMin: 180,
    hint: "Smoke, flames, fire crews on scene",
  },
  {
    id: "medical",
    label: "Medical Emergency",
    short: "Medical",
    color: "#FF5C8A",
    group: "medical",
    defaultSeverity: "moderate",
    staleAfterHours: 2,
    dedupeRadiusM: 200,
    dedupeWindowMin: 60,
    hint: "Ambulance or paramedics responding",
  },
  {
    id: "traffic_accident",
    label: "Traffic Accident",
    short: "Crash",
    color: "#FFC145",
    group: "traffic",
    defaultSeverity: "moderate",
    staleAfterHours: 2,
    dedupeRadiusM: 300,
    dedupeWindowMin: 90,
    hint: "Collision, lanes blocked, vehicles stopped",
  },
  {
    id: "road_hazard",
    label: "Road Hazard",
    short: "Hazard",
    color: "#E8D44D",
    group: "traffic",
    defaultSeverity: "low",
    staleAfterHours: 6,
    dedupeRadiusM: 250,
    dedupeWindowMin: 240,
    hint: "Debris, flooding, downed lines, closures",
  },
  {
    id: "suspicious",
    // Named for the behavior, not a vibe: reports describe what someone is doing.
    label: "Break-in or Theft",
    short: "Theft",
    color: "#B48CFF",
    group: "police",
    defaultSeverity: "low",
    staleAfterHours: 2,
    dedupeRadiusM: 250,
    dedupeWindowMin: 60,
    hint: "Someone breaking into a car or home, or taking something. Describe what they're doing, never how they look",
  },
  {
    id: "severe_weather",
    label: "Severe Weather",
    short: "Weather",
    color: "#4FC3F7",
    group: "weather",
    defaultSeverity: "high",
    staleAfterHours: 8,
    dedupeRadiusM: 3000,
    dedupeWindowMin: 360,
    hint: "Storms, flooding, heat, high winds",
  },
  {
    id: "public_safety",
    label: "Public Safety",
    short: "Safety",
    color: "#3DDC97",
    group: "other",
    defaultSeverity: "moderate",
    staleAfterHours: 6,
    dedupeRadiusM: 400,
    dedupeWindowMin: 180,
    hint: "Gas leaks, evacuations, outages, shelter notices",
  },
  {
    id: "missing_pet",
    label: "Missing Pet",
    short: "Pet",
    color: "#E58BFF",
    group: "other",
    defaultSeverity: "low",
    // Lost pets stay posted for days, not hours.
    staleAfterHours: 72,
    dedupeRadiusM: 300,
    dedupeWindowMin: 720,
    hint: "Lost or found dogs, cats and other pets",
  },
  // Storm Mode. Reports fade after 2h and disappear after 6h without a confirm.
  {
    id: "power",
    label: "Power",
    short: "Power",
    color: "#FFC233",
    group: "storm",
    defaultSeverity: "moderate",
    staleAfterHours: 6,
    dedupeRadiusM: 60,
    dedupeWindowMin: 360,
    hint: "Power out or back on on this block",
  },
  {
    id: "flooding",
    label: "Street flooding",
    short: "Flooding",
    color: "#FF3B30",
    group: "storm",
    defaultSeverity: "critical",
    staleAfterHours: 6,
    dedupeRadiusM: 60,
    dedupeWindowMin: 360,
    hint: "Flooded or passable street",
  },
  {
    id: "place",
    label: "Open places",
    short: "Place",
    color: "#34C759",
    group: "storm",
    defaultSeverity: "low",
    staleAfterHours: 6,
    dedupeRadiusM: 60,
    dedupeWindowMin: 360,
    hint: "A gas station, store or cooling center that's open or closed",
  },
  {
    id: "other",
    label: "Other",
    short: "Other",
    color: "#9AA4B2",
    group: "other",
    defaultSeverity: "low",
    staleAfterHours: 3,
    dedupeRadiusM: 200,
    dedupeWindowMin: 60,
    hint: "Anything else people nearby should know",
  },
] as const;

const BY_ID = new Map(CATEGORIES.map((c) => [c.id, c]));

export const CATEGORY_IDS = CATEGORIES.map((c) => c.id) as CategoryId[];

export function getCategory(id: CategoryId): CategoryDef {
  return BY_ID.get(id) ?? BY_ID.get("other")!;
}

export function isCategoryId(v: unknown): v is CategoryId {
  return typeof v === "string" && BY_ID.has(v as CategoryId);
}

export const FILTER_GROUPS: { id: FilterGroup; label: string }[] = [
  { id: "police", label: "Police" },
  { id: "fire", label: "Fire" },
  { id: "medical", label: "Medical" },
  { id: "traffic", label: "Traffic" },
  { id: "weather", label: "Weather" },
  { id: "other", label: "Other" },
];

export function categoriesInGroup(group: FilterGroup): CategoryId[] {
  return CATEGORIES.filter((c) => c.group === group).map((c) => c.id);
}

export const SEVERITY_RANK: Record<Severity, number> = {
  low: 0,
  moderate: 1,
  high: 2,
  critical: 3,
};

export const SEVERITY_LABEL: Record<Severity, string> = {
  low: "Low",
  moderate: "Moderate",
  high: "High",
  critical: "Critical",
};

export const STORM_CATEGORIES: CategoryId[] = ["power", "flooding", "place"];

export function isStormCategory(c: CategoryId): boolean {
  return STORM_CATEGORIES.includes(c);
}

/** Everyday categories: everything except Storm Mode's. Used by the report picker and alert settings. */
export const EVERYDAY_CATEGORIES: readonly CategoryDef[] = CATEGORIES.filter((c) => c.group !== "storm");
