import { approximate } from "@/lib/geo";
import type { CategoryId, Severity } from "@/lib/types";
import { fetchJson, type NormalizedIncident, type SourceAdapter } from "./types";

// Seattle Fire Department real-time 911 dispatches (public open data, updated
// every few minutes). https://data.seattle.gov/resource/kzjm-xkqj
// Privacy: addresses are reduced to the hundred-block and coordinates rounded
// to ~100 m. Routine aid calls and automatic alarms are skipped as noise.

interface Row {
  address?: string;
  type?: string;
  datetime?: string;
  latitude?: string;
  longitude?: string;
  incident_number?: string;
}

interface Rule {
  match: RegExp;
  category: CategoryId;
  severity: Severity;
  title: string;
}

// Order matters: first match wins. Types not matched are skipped.
const RULES: (Rule | { match: RegExp; skip: true })[] = [
  { match: /false|alarm|co detector|hang-up|out of service|trans to amr|low acuity|crisis center|special event|^aid response|aid response yellow|single medic/i, skip: true },
  { match: /fire in (building|single|res|.*bldg)|working fire|apartment fire|commercial fire/i, category: "fire", severity: "high", title: "Building fire response" },
  { match: /brush|bark|grass/i, category: "fire", severity: "moderate", title: "Brush fire" },
  { match: /car fire|vehicle fire|auto fire/i, category: "fire", severity: "moderate", title: "Vehicle fire" },
  { match: /rubbish|dumpster|illegal burn|trash/i, category: "fire", severity: "low", title: "Small outdoor fire" },
  { match: /fire/i, category: "fire", severity: "moderate", title: "Fire response" },
  { match: /mvi|motor vehicle/i, category: "traffic_accident", severity: "moderate", title: "Vehicle collision response" },
  { match: /gas|hazmat|hazardous/i, category: "public_safety", severity: "moderate", title: "Hazard response (gas/hazmat)" },
  { match: /rescue|water job|extrication|collapse/i, category: "public_safety", severity: "low", title: "Rescue response" },
  { match: /scenes? of violence/i, category: "police", severity: "moderate", title: "Emergency response (scene secured by police)" },
  { match: /medic|overdose|\dred|code red|mci/i, category: "medical", severity: "moderate", title: "Medical response" },
];

function classify(type: string): Rule | null {
  for (const r of RULES) {
    if (r.match.test(type)) return "skip" in r ? null : r;
  }
  return null;
}

/** "6561 Phinney Ave N" → "6500 block of Phinney Ave N". */
export function toBlock(address: string): string {
  const m = address.trim().match(/^(\d+)\s+(.+)$/);
  if (!m) return address.replace(/\s+/g, " ").trim();
  const block = Math.floor(Number(m[1]) / 100) * 100;
  return `${block} block of ${titleCase(m[2]!)}`;
}

function titleCase(s: string) {
  return s.toLowerCase().replace(/\b([a-z])/g, (c) => c.toUpperCase()).replace(/\b(Ne|Nw|Se|Sw|N|S|E|W)\b/g, (x) => x.toUpperCase());
}

/** The feed's timestamps are Seattle wall-clock time without an offset. */
export function seattleLocalToIso(local: string): string {
  const asUtc = new Date(`${local.replace(/\.\d+$/, "")}Z`);
  const tzName = new Intl.DateTimeFormat("en-US", {
    timeZone: "America/Los_Angeles",
    timeZoneName: "shortOffset",
  })
    .formatToParts(asUtc)
    .find((p) => p.type === "timeZoneName")?.value;
  const m = tzName?.match(/GMT([+-]\d+)/);
  const offsetH = m ? Number(m[1]) : -8;
  return new Date(asUtc.getTime() - offsetH * 3_600_000).toISOString();
}

export const seattleFireAdapter: SourceAdapter = {
  meta: {
    id: "seattle_fire_911",
    name: "Seattle Fire 911 dispatches",
    kind: "open_data",
    attribution: "Seattle Fire Department via data.seattle.gov (public open data)",
    url: "https://data.seattle.gov/Public-Safety/Seattle-Real-Time-Fire-911-Calls/kzjm-xkqj",
  },
  notify: true,
  async fetch(ctx) {
    const since = new Date(ctx.now.getTime() - 12 * 3_600_000);
    // The feed is in local time; a slightly-too-wide window is fine.
    const where = `datetime > '${since.toISOString().slice(0, 19)}'`;
    const url =
      "https://data.seattle.gov/resource/kzjm-xkqj.json?" +
      new URLSearchParams({ $where: where, $order: "datetime DESC", $limit: "400" }).toString();
    const rows = (await fetchJson(url, ctx)) as Row[];
    const out: NormalizedIncident[] = [];
    for (const r of rows) {
      if (!r.incident_number || !r.type || !r.datetime) continue;
      const lat = Number(r.latitude);
      const lng = Number(r.longitude);
      if (!Number.isFinite(lat) || !Number.isFinite(lng) || lat === 0) continue;
      const rule = classify(r.type);
      if (!rule) continue;
      const p = approximate({ lat, lng }, 3);
      out.push({
        externalId: r.incident_number,
        category: rule.category,
        title: rule.title,
        description: `Seattle Fire dispatched units for "${r.type}". Details come from the public dispatch log and may change.`,
        latitude: p.lat,
        longitude: p.lng,
        approximateAddress: r.address ? toBlock(r.address) : "Seattle",
        severity: rule.severity,
        status: "active",
        observedAt: seattleLocalToIso(r.datetime),
      });
    }
    return out;
  },
};
