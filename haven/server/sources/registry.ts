import type { PublicSource } from "@/lib/types";
import { demoAdapter } from "./demo";
import { nwsAlertsAdapter } from "./nwsAlerts";
import { seattleFireAdapter } from "./seattleFire";
import type { SourceAdapter } from "./types";

// Register new feeds here. Enable them with INCIDENT_SOURCES=demo,seattle_fire_911,...
export const ADAPTERS: SourceAdapter[] = [demoAdapter, seattleFireAdapter, nwsAlertsAdapter];

/** Community reports are a source too, with no adapter (they arrive via the API). */
export const USER_SOURCE: PublicSource = {
  id: "user",
  name: "Community report",
  kind: "user",
  attribution: "Reported by people nearby on Haven. Not verified by officials.",
};

const ALL: Map<string, PublicSource> = new Map(
  [USER_SOURCE, ...ADAPTERS.map((a) => a.meta)].map((s) => [s.id, s]),
);

export function publicSource(id: string): PublicSource {
  return ALL.get(id) ?? { id, name: id, kind: "open_data", attribution: id };
}

export function getAdapter(id: string): SourceAdapter | undefined {
  return ADAPTERS.find((a) => a.meta.id === id);
}
