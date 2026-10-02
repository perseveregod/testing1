import { createHash } from "node:crypto";
import { approximate } from "@/lib/geo";
import type { CategoryId, Severity } from "@/lib/types";
import { geocodeCensus } from "../geocode";
import { titleCase, toBlock } from "./format";
import { zonedLocalToIso } from "./time";
import type { FetchResult, NormalizedIncident, SourceAdapter, SourceContext } from "./types";

// City of Houston "Active Incidents": Fire, EMS and Police calls from the
// city's dispatch system, refreshed every five minutes as a public web page.
// https://cohweb.houstontx.gov/ActiveIncidents/Combined.aspx
//
// The page has no coordinates, so each new row is placed with the US Census
// geocoder (house number or intersection). Rows with only a street name are
// skipped: a pin somewhere along a ten-mile road would mislead. Privacy
// matches community reports: block-level addresses, ~100 m rounding.

export const HOUSTON_INCIDENTS_URL = "https://cohweb.houstontx.gov/ActiveIncidents/Combined.aspx";
/** New rows geocoded per run; the rest catch up on the next 5-minute run. */
const MAX_GEOCODES_PER_RUN = 12;
const TIME_ZONE = "America/Chicago";

export interface HoustonRow {
  agency: "FD" | "PD";
  address: string;
  cross: string;
  keyMap: string;
  callTime: string;
  type: string;
  combined: boolean;
}

interface Rule {
  match: RegExp;
  category: CategoryId;
  severity: Severity;
  title: string;
}

// First match wins. Alarms, welfare checks and unknowns are left out as noise.
const RULES: (Rule | { match: RegExp; skip: true })[] = [
  { match: /ALARM|CHECK PATIENT|UNKNOWN EVENT|SERVICE CALL|NO EMERGENCY|ELEVATOR|LOCKOUT|ANIMAL|TEST\b|CANCEL|WELFARE/i, skip: true },
  { match: /APARTMENT|STRUCTURE|HOUSE FIRE|BUILDING|COMMERCIAL|HIGH RISE|RESIDENTIAL FIRE|GARAGE FIRE/i, category: "fire", severity: "high", title: "Building fire" },
  { match: /CAR FIRE|VEHICLE FIRE|AUTO FIRE|TRUCK FIRE|BUS FIRE/i, category: "fire", severity: "moderate", title: "Vehicle fire" },
  { match: /GRASS|BRUSH|WOODS|WILDLAND/i, category: "fire", severity: "moderate", title: "Grass or brush fire" },
  { match: /TRASH|DUMPSTER|RUBBISH|POLE FIRE|TRANSFORMER/i, category: "fire", severity: "low", title: "Small outdoor fire" },
  { match: /EXPLOSION/i, category: "fire", severity: "critical", title: "Explosion reported" },
  { match: /FIRE|SMOKE/i, category: "fire", severity: "moderate", title: "Fire response" },
  { match: /FATALITY|(?<!NON\s)FATAL\b/i, category: "traffic_accident", severity: "critical", title: "Fatal crash" },
  { match: /PEDESTRIAN|BICYCL|CYCLIST|STRUCK/i, category: "traffic_accident", severity: "high", title: "Pedestrian or cyclist struck" },
  { match: /CRASH\s*\/\s*MAJOR|MAJOR ACCIDENT|MAJOR CRASH|ROLLOVER|OVERTURN/i, category: "traffic_accident", severity: "high", title: "Major crash" },
  { match: /CRASH\s*\/\s*MINOR|MINOR ACCIDENT|MINOR CRASH/i, category: "traffic_accident", severity: "low", title: "Minor crash" },
  { match: /CRASH|ACCIDENT|COLLISION|\bMVA\b/i, category: "traffic_accident", severity: "moderate", title: "Crash" },
  { match: /HIGH WATER|FLOOD/i, category: "road_hazard", severity: "moderate", title: "High water on the road" },
  { match: /HAZARD|STALL|DISABLED|DEBRIS|SIGNAL|ROAD/i, category: "road_hazard", severity: "low", title: "Traffic hazard" },
  { match: /GAS LEAK|\bGAS\b|HAZMAT|CHEMICAL|CARBON MONOXIDE|SPILL/i, category: "public_safety", severity: "moderate", title: "Gas leak or hazmat response" },
  { match: /RESCUE|DROWN|TRAPPED|COLLAPSE|WATER/i, category: "public_safety", severity: "high", title: "Rescue response" },
  { match: /SHOOT|\bSHOT\b|STAB|CUTTING|ASSAULT|WEAPON|ROBBERY|KIDNAP|HOSTAGE|HOMICIDE/i, category: "police", severity: "high", title: "Police response: violent incident" },
  { match: /BURGLAR|THEFT|STOLEN|CARJACK/i, category: "police", severity: "moderate", title: "Police response: theft or burglary" },
  { match: /DISTURBANCE|SUSPICIOUS|TRESPASS|PROWLER/i, category: "suspicious", severity: "low", title: "Police response: disturbance" },
  { match: /EMS|MEDICAL|OVERDOSE|CARDIAC|INJUR|SICK|UNCONSCIOUS|SEIZURE|BREATHING/i, category: "medical", severity: "low", title: "Medical call" },
];

export function classifyHouston(agency: "FD" | "PD", type: string): Rule | null {
  for (const r of RULES) {
    if (r.match.test(type)) return "skip" in r ? null : r;
  }
  return agency === "PD"
    ? { match: /./, category: "police", severity: "low", title: "Police response" }
    : { match: /./, category: "public_safety", severity: "low", title: "Fire department response" };
}

const clean = (html: string) =>
  html
    .replace(/<[^>]+>/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&nbsp;/g, " ")
    .replace(/&#39;|&apos;/g, "'")
    .replace(/&quot;/g, '"')
    .replace(/\s+/g, " ")
    .trim();

/** Pulls the seven-column incident rows out of the page. Tolerates layout noise around the table. */
export function parseHoustonTable(html: string): HoustonRow[] {
  const rows: HoustonRow[] = [];
  for (const tr of html.match(/<tr[\s\S]*?<\/tr>/gi) ?? []) {
    const cells = [...tr.matchAll(/<t[dh][^>]*>([\s\S]*?)<\/t[dh]>/gi)].map((m) => clean(m[1]!));
    if (cells.length !== 7 || (cells[0] !== "FD" && cells[0] !== "PD")) continue;
    const [agency, address, cross, keyMap, callTime, type, combined] = cells as [string, string, string, string, string, string, string];
    if (!address || !/^\d{2}\/\d{2}\/\d{4} \d{2}:\d{2}$/.test(callTime)) continue;
    rows.push({ agency: agency as "FD" | "PD", address, cross: cross.replace(/^BLK\s+/i, ""), keyMap, callTime, type, combined: combined === "Y" });
  }
  return rows;
}

/** "10/01/2026 03:37" (Houston wall clock) → ISO instant. */
export function houstonTimeToIso(callTime: string): string {
  const m = callTime.match(/^(\d{2})\/(\d{2})\/(\d{4}) (\d{2}):(\d{2})$/)!;
  return zonedLocalToIso(`${m[3]}-${m[1]}-${m[2]}T${m[4]}:${m[5]}:00`, TIME_ZONE);
}

/** Drops dispatch prefixes like "NUS59IB-NIH610" so "4005 N US 59 FWY" is what gets geocoded. */
function streetAddress(address: string): { number: string | null; street: string } {
  const m = address.match(/(?:^|\s)(\d+)\s+([A-Z][A-Z0-9 .'-]*)$/i);
  if (m) return { number: m[1]!, street: m[2]!.trim() };
  return { number: null, street: address.trim() };
}

/** The query sent to the geocoder, or null when the row can't be placed precisely. */
export function geocodeQuery(row: HoustonRow): string | null {
  const { number, street } = streetAddress(row.address);
  if (number) return `${number} ${street}, Houston, TX`;
  if (row.cross) return `${street} & ${row.cross}, Houston, TX`;
  return null;
}

/** What people see: block or intersection, never a house number. */
export function displayAddress(row: HoustonRow): string {
  const { number, street } = streetAddress(row.address);
  if (number) return toBlock(`${number} ${street}`);
  return row.cross ? `${titleCase(street)} & ${titleCase(row.cross)}` : titleCase(street);
}

export function houstonExternalId(row: HoustonRow): string {
  return createHash("sha1").update(`${row.agency}|${row.address}|${row.cross}|${row.callTime}`).digest("hex").slice(0, 20);
}

async function fetchPage(ctx: SourceContext): Promise<string> {
  const res = await fetch(HOUSTON_INCIDENTS_URL, {
    headers: { "User-Agent": ctx.userAgent, Accept: "text/html" },
    signal: AbortSignal.timeout(10_000),
    cache: "no-store",
  });
  if (!res.ok) throw new Error(`${HOUSTON_INCIDENTS_URL} → HTTP ${res.status}`);
  return res.text();
}

export const houstonActiveAdapter: SourceAdapter = {
  meta: {
    id: "houston_active",
    name: "Houston Fire, EMS & Police dispatches",
    kind: "open_data",
    attribution: "City of Houston Active Incidents (public dispatch page, refreshed every 5 minutes)",
    url: HOUSTON_INCIDENTS_URL,
  },
  authoritativeActiveSet: true,
  notify: true,
  async fetch(ctx): Promise<FetchResult> {
    const rows = parseHoustonTable(await fetchPage(ctx));
    const activeExternalIds: string[] = [];
    const items: NormalizedIncident[] = [];
    let geocodes = 0;
    for (const row of rows) {
      const rule = classifyHouston(row.agency, row.type);
      if (!rule) continue;
      const query = geocodeQuery(row);
      if (!query) continue;
      const externalId = houstonExternalId(row);
      activeExternalIds.push(externalId);
      if (await ctx.isKnown(externalId)) continue;
      if (geocodes >= MAX_GEOCODES_PER_RUN) continue;
      geocodes++;
      const point = await geocodeCensus(query);
      if (!point) continue;
      const p = approximate(point, 3);
      const unit = row.agency === "PD" ? "Houston Police" : "Houston Fire Department";
      items.push({
        externalId,
        category: rule.category,
        title: rule.title,
        // Short and specific; the source note lives in the attribution line.
        description: `${unit} dispatched for "${titleCase(row.type)}"${row.combined ? ", with police" : ""}.`,
        latitude: p.lat,
        longitude: p.lng,
        approximateAddress: displayAddress(row),
        severity: rule.severity,
        status: "active",
        observedAt: houstonTimeToIso(row.callTime),
      });
    }
    return { items, activeExternalIds };
  },
};
