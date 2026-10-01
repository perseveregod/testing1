// Storm Mode: states, labels (English / Spanish), colors and fading rules.
// Shared by the server (validation, override rules) and the client (pins,
// report sheet, banner). Plain data, no React.

import type { CategoryId, StormInfo, StormPlaceType, StormState } from "./types";

export type Lang = "en" | "es";

export type StormKind = "power" | "flooding" | "place";

export const STORM_KINDS: StormKind[] = ["power", "flooding", "place"];

/** The two states each kind of report can be in, good news last. */
export const STATES_FOR: Record<StormKind, [StormState, StormState]> = {
  power: ["out", "on"],
  flooding: ["flooded", "passable"],
  place: ["closed", "open"],
};

export const PLACE_TYPES: StormPlaceType[] = ["gas", "grocery", "laundromat", "restaurant", "cooling", "charging"];

export function isValidStorm(category: CategoryId, storm: StormInfo | null | undefined): boolean {
  if (category !== "power" && category !== "flooding" && category !== "place") return !storm;
  if (!storm || !STATES_FOR[category].includes(storm.state)) return false;
  if (category === "place") return storm.placeType != null && PLACE_TYPES.includes(storm.placeType);
  return storm.placeType == null;
}

// ---- look ---------------------------------------------------------------------

export interface StateStyle {
  color: string;
  /** "bad" states (out, flooded, closed) vs "good" ones. */
  bad: boolean;
}

export const STATE_STYLE: Record<StormState, StateStyle> = {
  out: { color: "#FFB020", bad: true },
  on: { color: "#34C759", bad: false },
  // Flooded streets are the one thing nobody should miss.
  flooded: { color: "#FF2D20", bad: true },
  passable: { color: "#30B0C7", bad: false },
  open: { color: "#34C759", bad: false },
  closed: { color: "#8E8E93", bad: true },
};

/** Severity used for sorting and pin size. */
export function stormSeverity(state: StormState): "low" | "moderate" | "high" | "critical" {
  if (state === "flooded") return "critical";
  if (state === "out") return "moderate";
  return "low";
}

// ---- fading -------------------------------------------------------------------

export const STORM_FULL_HOURS = 2;
export const STORM_HIDE_HOURS = 6;

/**
 * 1 for the first 2 hours since the last report or confirmation, easing to
 * 0.45 by 6 hours, then 0 (hidden).
 */
export function stormFade(lastActivity: string, now = Date.now()): number {
  const h = (now - new Date(lastActivity).getTime()) / 3_600_000;
  if (h <= STORM_FULL_HOURS) return 1;
  if (h >= STORM_HIDE_HOURS) return 0;
  return 1 - ((h - STORM_FULL_HOURS) / (STORM_HIDE_HOURS - STORM_FULL_HOURS)) * 0.55;
}

// ---- words --------------------------------------------------------------------

const T = {
  en: {
    stormMode: "Storm Mode",
    on: "On",
    off: "Off",
    banner: "Community reports, not official. In an emergency call 911. Turn around, don't drown.",
    bannerShort: "Not official",
    officialSources: "Official sources",
    officialSourcesShort: "Sources",
    officialIntro: "Haven shows community reports, not official information. In an emergency call 911. Turn around, don't drown. For confirmed information, check these sources.",
    report: "Report",
    reportTitle: "What's happening here?",
    reportWhere: "Reported for this block, never your exact address.",
    reportAt: "Location",
    useMap: "Map center",
    useMe: "My location",
    note: "Add a short note (optional)",
    photo: "Add photo",
    photoHint: "No faces or license plates.",
    removePhoto: "Remove photo",
    send: "Send report",
    sent: "Thanks. Your report is on the map.",
    whichPlace: "Which kind of place?",
    filterAll: "All",
    kind_power: "Power",
    kind_flooding: "Flooding",
    kind_place: "Open places",
    state_out: "Power out",
    state_on: "Power back on",
    state_flooded: "Flooded, don't drive",
    state_passable: "Passable",
    state_open: "Open",
    state_closed: "Closed",
    place_gas: "Gas station",
    place_grocery: "Grocery",
    place_laundromat: "Laundromat",
    place_restaurant: "Restaurant",
    place_cooling: "Cooling center",
    place_charging: "Phone charging",
    confirm: "Still true",
    confirmed: "Confirmed",
    confirms: (n: number) => (n === 1 ? "1 neighbor confirmed" : `${n} neighbors confirmed`),
    noConfirms: "Not confirmed yet",
    ago: "Reported",
    empty: "No storm reports in view. Be the first to report power, flooding or an open place.",
    suggest: "Weather alert in effect. Turn on Storm Mode?",
    turnOn: "Turn on",
    tsDesc: "Live traffic and high-water locations on major roads",
    fwsDesc: "Rainfall and bayou levels across Harris County",
    cpDesc: "Official power outage map and restoration times",
  },
  es: {
    stormMode: "Modo tormenta",
    on: "Activado",
    off: "Desactivado",
    banner: "Reportes de la comunidad, no oficiales. En una emergencia llame al 911. Dé la vuelta, no se ahogue.",
    bannerShort: "No oficial",
    officialSources: "Fuentes oficiales",
    officialSourcesShort: "Fuentes",
    officialIntro: "Haven muestra reportes de la comunidad, no información oficial. En una emergencia llame al 911. Dé la vuelta, no se ahogue. Para información confirmada, consulte estas fuentes.",
    report: "Reportar",
    reportTitle: "¿Qué está pasando aquí?",
    reportWhere: "Se reporta para esta cuadra, nunca su dirección exacta.",
    reportAt: "Ubicación",
    useMap: "Centro del mapa",
    useMe: "Mi ubicación",
    note: "Agregue una nota corta (opcional)",
    photo: "Agregar foto",
    photoHint: "Sin caras ni placas.",
    removePhoto: "Quitar foto",
    send: "Enviar reporte",
    sent: "Gracias. Su reporte está en el mapa.",
    whichPlace: "¿Qué tipo de lugar?",
    filterAll: "Todo",
    kind_power: "Luz",
    kind_flooding: "Inundación",
    kind_place: "Lugares abiertos",
    state_out: "Sin luz",
    state_on: "Ya hay luz",
    state_flooded: "Inundada, no maneje",
    state_passable: "Transitable",
    state_open: "Abierto",
    state_closed: "Cerrado",
    place_gas: "Gasolinera",
    place_grocery: "Supermercado",
    place_laundromat: "Lavandería",
    place_restaurant: "Restaurante",
    place_cooling: "Centro de enfriamiento",
    place_charging: "Carga de teléfonos",
    confirm: "Sigue igual",
    confirmed: "Confirmado",
    confirms: (n: number) => (n === 1 ? "1 vecino confirmó" : `${n} vecinos confirmaron`),
    noConfirms: "Aún sin confirmar",
    ago: "Reportado",
    empty: "No hay reportes de tormenta aquí. Sea el primero en reportar luz, inundación o un lugar abierto.",
    suggest: "Alerta del clima vigente. ¿Activar el modo tormenta?",
    turnOn: "Activar",
    tsDesc: "Tráfico en vivo y calles inundadas en vías principales",
    fwsDesc: "Lluvia y nivel de los bayous en el condado de Harris",
    cpDesc: "Mapa oficial de apagones y tiempos de restauración",
  },
} as const;

export type StormStrings = (typeof T)["en"];

export function strings(lang: Lang): StormStrings {
  return T[lang] as StormStrings;
}

export function stateLabel(state: StormState, lang: Lang): string {
  return strings(lang)[`state_${state}`];
}

export function placeLabel(type: StormPlaceType, lang: Lang): string {
  return strings(lang)[`place_${type}`];
}

export function kindLabel(kind: StormKind, lang: Lang): string {
  return strings(lang)[`kind_${kind}`];
}

/** One-line title for a storm report, e.g. "Gas station · Open". */
export function stormTitle(storm: StormInfo, lang: Lang): string {
  return storm.placeType ? `${placeLabel(storm.placeType, lang)} · ${stateLabel(storm.state, lang)}` : stateLabel(storm.state, lang);
}

export const OFFICIAL_SOURCES = [
  { id: "transtar", name: "Houston TranStar", url: "https://traffic.houstontranstar.org/", desc: "tsDesc" },
  { id: "fws", name: "Harris County Flood Warning System", url: "https://www.harriscountyfws.org/", desc: "fwsDesc" },
  { id: "centerpoint", name: "CenterPoint Energy outage tracker", url: "https://gis.centerpointenergy.com/outagetracker/", desc: "cpDesc" },
] as const;
