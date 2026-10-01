import { offsetMeters } from "@/lib/geo";
import { stormSeverity, stormTitle } from "@/lib/storm";
import type { CategoryId, IncidentStatus, Severity, StormPlaceType, StormState } from "@/lib/types";
import type { NormalizedIncident, SourceAdapter } from "./types";

// Clearly-labeled fictional incidents placed around DEMO_CENTER so the app is
// explorable without real data. Every item is titled and attributed as DEMO
// DATA in the UI and API (`isDemo: true`). None describe real events.

interface Seed {
  category: CategoryId;
  title: string;
  description: string;
  north: number;
  east: number;
  minutesAgo: number;
  severity: Severity;
  status?: IncidentStatus;
  area: string;
}

const SEEDS: Seed[] = [
  { category: "traffic_accident", title: "Two-vehicle collision", description: "Two cars stopped in the right lane after a collision. Expect delays heading north.", north: 1200, east: -400, minutesAgo: 6, severity: "moderate", area: "I-45 & I-10 interchange" },
  { category: "fire", title: "Smoke from building", description: "Light smoke reported from a commercial building. Fire crews on scene.", north: -500, east: 1600, minutesAgo: 14, severity: "high", area: "EaDo near St. Emanuel St" },
  { category: "police", title: "Police activity", description: "Several police vehicles on the block. Sidewalk partially closed.", north: -2600, east: -3000, minutesAgo: 22, severity: "moderate", area: "Westheimer Rd, Montrose" },
  { category: "medical", title: "Medical response", description: "Paramedics responding. Give emergency vehicles room to pass.", north: -300, east: 700, minutesAgo: 9, severity: "moderate", area: "Discovery Green" },
  { category: "road_hazard", title: "Debris in roadway", description: "Large debris blocking the left lane. Drive with caution.", north: -1200, east: -9500, minutesAgo: 41, severity: "low", area: "610 West Loop" },
  { category: "public_safety", title: "Gas odor reported", description: "Utility crew checking a reported gas odor. Area may be taped off.", north: 2200, east: 2600, minutesAgo: 55, severity: "moderate", area: "Fifth Ward" },
  { category: "suspicious", title: "Car break-ins reported", description: "Several vehicles found with broken windows overnight. Remove valuables from parked cars.", north: 800, east: -3000, minutesAgo: 95, severity: "low", area: "Washington Ave" },
  { category: "severe_weather", title: "Flash flood warning", description: "Heavy rain expected this evening. Avoid low-water crossings and underpasses.", north: 0, east: -2200, minutesAgo: 130, severity: "moderate", area: "Buffalo Bayou" },
  { category: "traffic_accident", title: "Vehicle vs. cyclist", description: "Collision involving a cyclist. Medics on scene. Lane closed.", north: 4500, east: -2500, minutesAgo: 70, severity: "high", area: "Heights Blvd" },
  { category: "fire", title: "Grass fire contained", description: "Small grass fire along the trail is out. Crews mopping up.", north: 300, east: -6500, minutesAgo: 160, severity: "low", status: "contained", area: "Memorial Park" },
  { category: "police", title: "Road closed for investigation", description: "Street closed between two blocks while police investigate. Use alternate routes.", north: -3200, east: 1800, minutesAgo: 200, severity: "moderate", area: "Third Ward" },
  { category: "medical", title: "Medical response", description: "Ambulance and fire unit responding to a medical call.", north: -7400, east: -1600, minutesAgo: 35, severity: "low", area: "Texas Medical Center" },
  { category: "road_hazard", title: "Traffic signal out", description: "Signal dark at the intersection. Treat as an all-way stop.", north: -2400, east: -600, minutesAgo: 18, severity: "low", area: "Midtown, Main St" },
  { category: "other", title: "Power outage", description: "Utility reports an outage affecting a few blocks. Estimated restoration in 2 hours.", north: 2800, east: 400, minutesAgo: 80, severity: "low", area: "Near Northside" },
  { category: "public_safety", title: "Evacuation lifted", description: "Earlier precautionary evacuation lifted. Residents may return.", north: -200, east: 3500, minutesAgo: 300, severity: "moderate", status: "resolved", area: "Second Ward" },
  { category: "police", title: "Large police presence", description: "Officers responding in the area. Avoid if possible.", north: -1500, east: -10500, minutesAgo: 12, severity: "high", area: "Galleria" },
  { category: "traffic_accident", title: "Multi-car crash on ramp", description: "Three vehicles involved on the on-ramp. Ramp closed.", north: -2600, east: -5200, minutesAgo: 27, severity: "high", area: "US-59 & Kirby Dr" },
  { category: "fire", title: "Vehicle fire", description: "Car fire in a parking lot. Firefighters have it under control.", north: -4600, east: -1200, minutesAgo: 48, severity: "moderate", area: "Museum District" },
  { category: "medical", title: "Medical response", description: "Medics responding near the ballpark.", north: 200, east: 900, minutesAgo: 3, severity: "moderate", area: "Minute Maid Park" },
  { category: "road_hazard", title: "Flooded underpass", description: "Standing water in the underpass. Do not drive through flooded roads.", north: 300, east: 100, minutesAgo: 65, severity: "moderate", area: "Downtown, Main St" },
  { category: "missing_pet", title: "Lost dog: brown lab mix", description: "Friendly brown lab mix with a red collar, last seen near the park. Don't chase; note where you saw him and add an update.", north: -2900, east: -2600, minutesAgo: 110, severity: "low", area: "Montrose, near Menil Park" },
];

// Storm Mode demo: what a Houston storm night might look like, block by block.
// Offsets are meters from downtown; places are generic, never real businesses.
interface StormSeed {
  category: "power" | "flooding" | "place";
  state: StormState;
  placeType?: StormPlaceType;
  north: number;
  east: number;
  minutesAgo: number;
  confirmations: number;
  area: string;
  note: string;
}

const STORM_SEEDS: StormSeed[] = [
  // Meyerland / Braeswood: low-lying, floods first
  { category: "flooding", state: "flooded", north: -8100, east: -9200, minutesAgo: 18, confirmations: 6, area: "S Braeswood Blvd, Meyerland", note: "Water over the curb, cars stalled near the bayou." },
  { category: "flooding", state: "flooded", north: -7900, east: -8400, minutesAgo: 40, confirmations: 3, area: "Chimney Rock Rd, Meyerland", note: "Underpass full of water." },
  { category: "power", state: "out", north: -8300, east: -9800, minutesAgo: 75, confirmations: 9, area: "Braeburn Glen", note: "Whole street dark since the storm hit." },
  // Gulfton
  { category: "power", state: "out", north: -4200, east: -10600, minutesAgo: 55, confirmations: 4, area: "Gulfton Dr, Gulfton", note: "" },
  { category: "place", state: "open", placeType: "laundromat", north: -4400, east: -10200, minutesAgo: 30, confirmations: 2, area: "Bellaire Blvd, Gulfton", note: "Running on a generator, outlets to charge phones." },
  // Acres Homes / Northline
  { category: "power", state: "out", north: 11600, east: -7300, minutesAgo: 95, confirmations: 7, area: "W Little York Rd, Acres Homes", note: "" },
  { category: "place", state: "open", placeType: "cooling", north: 11200, east: -6800, minutesAgo: 65, confirmations: 5, area: "Acres Homes multi-service center", note: "AC and water inside." },
  { category: "flooding", state: "passable", north: 10900, east: -6200, minutesAgo: 25, confirmations: 2, area: "Pinemont Dr, Acres Homes", note: "Water went down, slow but passable." },
  // Kashmere Gardens / Fifth Ward
  { category: "flooding", state: "flooded", north: 4400, east: 4800, minutesAgo: 12, confirmations: 4, area: "Lockwood Dr underpass", note: "Do not drive through, a car is stuck." },
  { category: "power", state: "out", north: 4700, east: 5300, minutesAgo: 140, confirmations: 3, area: "Kashmere Gardens", note: "" },
  // Heights
  { category: "power", state: "on", north: 3300, east: -2900, minutesAgo: 20, confirmations: 3, area: "W 19th St, Heights", note: "Lights just came back." },
  { category: "place", state: "open", placeType: "grocery", north: 3600, east: -3400, minutesAgo: 45, confirmations: 6, area: "Yale St, Heights", note: "Open, but low on water and ice." },
  // Third Ward / Midtown
  { category: "place", state: "open", placeType: "charging", north: -2800, east: 1000, minutesAgo: 35, confirmations: 2, area: "Emancipation Park area, Third Ward", note: "Free charging tables at the community center." },
  { category: "power", state: "out", north: -3100, east: 1600, minutesAgo: 190, confirmations: 2, area: "Third Ward", note: "" },
  { category: "place", state: "open", placeType: "restaurant", north: -1500, east: -600, minutesAgo: 50, confirmations: 1, area: "Main St, Midtown", note: "Taking cash only." },
  { category: "flooding", state: "passable", north: -1200, east: 1600, minutesAgo: 80, confirmations: 1, area: "S Dearborn St, EaDo", note: "" },
  // Greenspoint
  { category: "flooding", state: "flooded", north: 20000, east: -3900, minutesAgo: 35, confirmations: 5, area: "Greens Rd at I-45 feeder", note: "Feeder road under water." },
  { category: "place", state: "closed", placeType: "gas", north: 19600, east: -4400, minutesAgo: 110, confirmations: 2, area: "Greens Rd, Greenspoint", note: "Pumps off, no power." },
  // Alief
  { category: "place", state: "open", placeType: "gas", north: -6700, east: -21300, minutesAgo: 15, confirmations: 8, area: "Bellaire Blvd, Alief", note: "Open, line about 20 cars." },
  { category: "power", state: "out", north: -6400, east: -20500, minutesAgo: 230, confirmations: 4, area: "Alief", note: "" },
  // Montrose
  { category: "power", state: "on", north: -2600, east: -3000, minutesAgo: 65, confirmations: 2, area: "Westheimer Rd, Montrose", note: "" },
];

function stormItems(ctx: { now: Date; demoCenter: { lat: number; lng: number } }): NormalizedIncident[] {
  return STORM_SEEDS.map((s, i) => {
    const p = offsetMeters(ctx.demoCenter, s.north, s.east);
    const storm = { state: s.state, placeType: s.placeType ?? null };
    return {
      externalId: `demo-storm-${i + 1}`,
      category: s.category,
      title: stormTitle(storm, "en"),
      description: s.note,
      latitude: Math.round(p.lat * 1e3) / 1e3,
      longitude: Math.round(p.lng * 1e3) / 1e3,
      approximateAddress: s.area,
      severity: stormSeverity(s.state),
      status: "active",
      observedAt: new Date(ctx.now.getTime() - s.minutesAgo * 60_000).toISOString(),
      storm,
      confirmations: s.confirmations,
    };
  });
}

export const demoAdapter: SourceAdapter = {
  meta: {
    id: "demo",
    name: "Demo data",
    kind: "demo",
    attribution: "DEMO DATA: fictional incidents for testing. Not real events.",
  },
  rolling: true,
  notify: false,
  async fetch(ctx) {
    return SEEDS.map((s, i): NormalizedIncident => {
      const p = offsetMeters(ctx.demoCenter, s.north, s.east);
      return {
        externalId: `demo-${i + 1}`,
        category: s.category,
        title: s.title,
        description: s.description,
        latitude: Math.round(p.lat * 1e5) / 1e5,
        longitude: Math.round(p.lng * 1e5) / 1e5,
        approximateAddress: s.area,
        severity: s.severity,
        status: s.status ?? "active",
        observedAt: new Date(ctx.now.getTime() - s.minutesAgo * 60_000).toISOString(),
      };
    }).concat(stormItems(ctx));
  },
};
