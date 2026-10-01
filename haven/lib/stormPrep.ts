import type { Lang } from "@/lib/storm";

// Storm prep: a short, Houston-specific checklist and the City's regular
// cooling / warming center sites. Sources are linked in the UI.

export interface PrepItem {
  id: string;
  en: string;
  es: string;
  /** Short why, shown under the item. */
  whyEn?: string;
  whyEs?: string;
}

export const PREP_ITEMS: PrepItem[] = [
  { id: "water", en: "Water: 1 gallon per person per day, 3 days", es: "Agua: 1 galón por persona por día, 3 días" },
  { id: "food", en: "Food that keeps without power, 3 days, plus a manual can opener", es: "Comida que no necesite refrigeración, 3 días, y un abrelatas manual" },
  { id: "meds", en: "Medications for 7 days and photos of your prescriptions", es: "Medicinas para 7 días y fotos de sus recetas" },
  { id: "power", en: "Phones and a power bank fully charged", es: "Teléfonos y una batería portátil cargados" },
  { id: "light", en: "Flashlight and batteries, not candles", es: "Linterna y pilas, no velas", whyEn: "Candles start fires in outages.", whyEs: "Las velas causan incendios cuando no hay luz." },
  { id: "alerts", en: "Weather alerts on: NWS, Haven, a weather radio", es: "Alertas del clima activadas: NWS, Haven, radio del clima" },
  { id: "cash", en: "Some cash", es: "Algo de efectivo", whyEn: "Card readers and ATMs go down with the power.", whyEs: "Los cajeros y lectores de tarjeta fallan sin luz." },
  { id: "docs", en: "ID, insurance and important papers in a sealed bag, photos on your phone", es: "Identificación, seguro y documentos en una bolsa sellada, fotos en su teléfono" },
  { id: "gas", en: "Gas tank full; car parked on high ground", es: "Tanque lleno; carro estacionado en lugar alto" },
  { id: "zone", en: "Know your evacuation zone and route", es: "Conozca su zona y ruta de evacuación" },
  { id: "generator", en: "Generator only outdoors, 20 ft from windows", es: "Generador solo afuera, a 20 pies de las ventanas", whyEn: "Carbon monoxide kills every storm season.", whyEs: "El monóxido de carbono mata cada temporada." },
  { id: "pets", en: "Pet food, carrier and vaccination records", es: "Comida para mascotas, transportadora y vacunas" },
  { id: "drown", en: "Never drive through water on the road", es: "Nunca maneje por agua en la calle", whyEn: "Turn around, don't drown. Most flood deaths are in cars.", whyEs: "Dé la vuelta, no se ahogue. La mayoría muere en su carro." },
];

export const PREP_SOURCES = [
  { name: "Ready Harris (Harris County)", url: "https://www.readyharris.org/" },
  { name: "Houston Office of Emergency Management", url: "https://www.houstonemergency.org/" },
  { name: "Ready.gov hurricane checklist", url: "https://www.ready.gov/hurricanes" },
];

export interface CoolingCenter {
  id: string;
  name: string;
  address: string;
  zip: string;
}

/**
 * The City of Houston's multi-service centers: the sites it opens as cooling
 * centers in heat and warming centers in freezes. Hours change per event, so
 * the UI always says to confirm by calling 311.
 * Source: City of Houston Heat Emergency Plan (houstontx.gov).
 */
export const COOLING_CENTERS: CoolingCenter[] = [
  { id: "tidwell", name: "Tidwell Community Center", address: "9720 Spaulding St", zip: "77016" },
  { id: "metropolitan", name: "Metropolitan Multi-Service Center", address: "1475 W Gray St", zip: "77019" },
  { id: "acres-homes", name: "Acres Homes Multi-Service Center", address: "6719 W Montgomery Rd", zip: "77091" },
  { id: "sunnyside", name: "Sunnyside Health and Multi-Service Center", address: "4410 Reed Rd", zip: "77051" },
  { id: "alief", name: "Alief Neighborhood Center", address: "11903 Bellaire Blvd", zip: "77072" },
  { id: "denver-harbor", name: "Denver Harbor Multi-Service Center", address: "6402 Market St", zip: "77020" },
  { id: "fifth-ward", name: "Fifth Ward Multi-Service Center", address: "4014 Market St", zip: "77020" },
  { id: "hiram-clarke", name: "Hiram Clarke Multi-Service Center", address: "3810 W Fuqua St", zip: "77045" },
  { id: "kashmere", name: "Kashmere Multi-Service Center", address: "4802 Lockwood Dr", zip: "77026" },
  { id: "magnolia", name: "Magnolia Multi-Service Center", address: "7037 Capitol St", zip: "77011" },
  { id: "southwest", name: "Southwest Multi-Service Center", address: "6400 High Star Dr", zip: "77074" },
  { id: "third-ward", name: "Third Ward Multi-Service Center", address: "3611 Ennis St", zip: "77004" },
  { id: "west-end", name: "West End Multi-Service Center", address: "170 Heights Blvd", zip: "77007" },
];

export const COOLING_SOURCE = {
  name: "City of Houston Heat Emergency Plan",
  url: "https://www.houstontx.gov/citizensnet/2023/HeatEmergencyPlan20230614.html",
  /** When someone last compared this list against the City's page. Re-check every season. */
  checked: "2026-10",
};

export function prepText(item: PrepItem, lang: Lang) {
  return { text: lang === "es" ? item.es : item.en, why: lang === "es" ? item.whyEs : item.whyEn };
}
