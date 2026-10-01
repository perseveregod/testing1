import { offsetMeters } from "@/lib/geo";
import type { CategoryId, IncidentStatus, Severity } from "@/lib/types";
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
  { category: "traffic_accident", title: "Two-vehicle collision", description: "Two cars stopped in the right lane after a collision. Expect delays heading north.", north: 420, east: -180, minutesAgo: 6, severity: "moderate", area: "4th Ave & Pine St" },
  { category: "fire", title: "Smoke from building", description: "Light smoke reported from a commercial building. Fire crews on scene.", north: -650, east: 520, minutesAgo: 14, severity: "high", area: "Near Occidental Park" },
  { category: "police", title: "Police activity", description: "Several police vehicles on the block. Sidewalk partially closed.", north: 1200, east: 900, minutesAgo: 22, severity: "moderate", area: "Broadway & E Pine St" },
  { category: "medical", title: "Medical response", description: "Paramedics responding. Give emergency vehicles room to pass.", north: -150, east: -420, minutesAgo: 9, severity: "moderate", area: "1st Ave & Union St" },
  { category: "road_hazard", title: "Debris in roadway", description: "Large debris blocking the left lane. Drive with caution.", north: 2600, east: -1500, minutesAgo: 41, severity: "low", area: "Elliott Ave W" },
  { category: "public_safety", title: "Gas odor reported", description: "Utility crew checking a reported gas odor. Area may be taped off.", north: -2100, east: -300, minutesAgo: 55, severity: "moderate", area: "S Jackson St" },
  { category: "suspicious", title: "Car break-ins reported", description: "Several vehicles found with broken windows overnight. Remove valuables from parked cars.", north: 3200, east: 1800, minutesAgo: 95, severity: "low", area: "Capitol Hill" },
  { category: "severe_weather", title: "Wind advisory", description: "Gusts up to 45 mph expected this evening. Secure loose outdoor items.", north: 0, east: 3800, minutesAgo: 130, severity: "moderate", area: "Central District" },
  { category: "traffic_accident", title: "Vehicle vs. cyclist", description: "Collision involving a cyclist. Medics on scene. Lane closed.", north: 5200, east: -2600, minutesAgo: 70, severity: "high", area: "Westlake Ave N" },
  { category: "fire", title: "Brush fire contained", description: "Small brush fire along the trail is out. Crews mopping up.", north: -4300, east: 2500, minutesAgo: 160, severity: "low", status: "contained", area: "Beacon Hill" },
  { category: "police", title: "Road closed for investigation", description: "Street closed between two blocks while police investigate. Use alternate routes.", north: -3000, east: -2400, minutesAgo: 200, severity: "moderate", area: "SoDo" },
  { category: "medical", title: "Medical response", description: "Ambulance and fire unit responding to a medical call.", north: 6400, east: 600, minutesAgo: 35, severity: "low", area: "Eastlake" },
  { category: "road_hazard", title: "Traffic signal out", description: "Signal dark at the intersection. Treat as an all-way stop.", north: 1800, east: 2900, minutesAgo: 18, severity: "low", area: "E Madison St" },
  { category: "other", title: "Power outage", description: "Utility reports an outage affecting a few blocks. Estimated restoration in 2 hours.", north: 7600, east: 3400, minutesAgo: 80, severity: "low", area: "Montlake" },
  { category: "public_safety", title: "Evacuation lifted", description: "Earlier precautionary evacuation lifted. Residents may return.", north: -6200, east: -900, minutesAgo: 300, severity: "moderate", status: "resolved", area: "Georgetown" },
  { category: "police", title: "Large police presence", description: "Officers responding in the area. Avoid if possible.", north: 9000, east: -4200, minutesAgo: 12, severity: "high", area: "Fremont" },
  { category: "traffic_accident", title: "Multi-car crash on ramp", description: "Three vehicles involved on the on-ramp. Ramp closed.", north: -8200, east: 4100, minutesAgo: 27, severity: "high", area: "I-5 / Columbian Way" },
  { category: "fire", title: "Vehicle fire", description: "Car fire in a parking lot. Firefighters have it under control.", north: 11000, east: 2200, minutesAgo: 48, severity: "moderate", area: "University District" },
  { category: "medical", title: "Medical response", description: "Medics responding near the transit station.", north: 300, east: 260, minutesAgo: 3, severity: "moderate", area: "Westlake Center" },
  { category: "road_hazard", title: "Flooded underpass", description: "Standing water in the underpass. Do not drive through flooded roads.", north: -1200, east: 1600, minutesAgo: 65, severity: "moderate", area: "S Dearborn St" },
];

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
    });
  },
};
