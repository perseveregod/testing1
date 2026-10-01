"use client";

import { useSyncExternalStore, useState } from "react";
import useSWR from "swr";
import { Check, ExternalLink, Navigation, Phone } from "lucide-react";
import { fetcher } from "@/lib/client/api";
import { useStormPrefs } from "@/lib/client/stormMode";
import { distanceMiles, formatDistance, type LatLng } from "@/lib/geo";
import { COOLING_CENTERS, COOLING_SOURCE, PREP_ITEMS, PREP_SOURCES, prepText } from "@/lib/stormPrep";
import { useLocation } from "@/components/providers/LocationProvider";
import { Segmented } from "@/components/ui/Controls";
import { Sheet } from "@/components/ui/Sheet";

// Checked items live on this device only.
const KEY = "haven.prep.v1";
const listeners = new Set<() => void>();
let snapshot: string[] | null = null;
function read(): string[] {
  if (snapshot) return snapshot;
  try {
    snapshot = JSON.parse(localStorage.getItem(KEY) ?? "[]") as string[];
  } catch {
    snapshot = [];
  }
  return snapshot;
}
function toggle(id: string) {
  const cur = read();
  snapshot = cur.includes(id) ? cur.filter((x) => x !== id) : [...cur, id];
  try {
    localStorage.setItem(KEY, JSON.stringify(snapshot));
  } catch {
    // Storage blocked: lasts for this visit.
  }
  listeners.forEach((l) => l());
}
const EMPTY: string[] = [];
function useChecked(): string[] {
  return useSyncExternalStore(
    (cb) => {
      listeners.add(cb);
      return () => listeners.delete(cb);
    },
    read,
    () => EMPTY,
  );
}

interface Center {
  id: string;
  name: string;
  address: string;
  zip: string;
  lat: number | null;
  lng: number | null;
}

/** Storm Mode's "Prepare" sheet: a checklist and the City's cooling / warming centers. */
export function StormPrepSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useStormPrefs();
  const es = lang === "es";
  const [tab, setTab] = useState<"list" | "centers">("list");
  const checked = useChecked();
  const done = PREP_ITEMS.filter((i) => checked.includes(i.id)).length;

  return (
    <Sheet open={open} onClose={onClose} title={es ? "Prepárese" : "Prepare"}>
      <div className="mb-3">
        <Segmented
          label={es ? "Sección" : "Section"}
          value={tab}
          onChange={setTab}
          options={[
            { value: "list", label: es ? `Lista · ${done}/${PREP_ITEMS.length}` : `Checklist · ${done}/${PREP_ITEMS.length}` },
            { value: "centers", label: es ? "Centros" : "Cooling centers" },
          ]}
        />
      </div>
      {tab === "list" ? <Checklist es={es} checked={checked} /> : <Centers es={es} />}
    </Sheet>
  );
}

function Checklist({ es, checked }: { es: boolean; checked: string[] }) {
  return (
    <div className="pb-2">
      <ul className="divide-y divide-line overflow-hidden rounded-[18px] bg-surface-2">
        {PREP_ITEMS.map((item) => {
          const on = checked.includes(item.id);
          const { text, why } = prepText(item, es ? "es" : "en");
          return (
            <li key={item.id}>
              <button
                onClick={() => toggle(item.id)}
                role="checkbox"
                aria-checked={on}
                className="flex min-h-[52px] w-full items-start gap-3 px-4 py-3 text-left active:bg-surface-3"
              >
                <span
                  className={`mt-0.5 flex size-[22px] shrink-0 items-center justify-center rounded-full border-[1.5px] transition-colors ${
                    on ? "border-ok bg-ok text-white" : "border-line-strong"
                  }`}
                  aria-hidden
                >
                  {on && <Check className="size-3.5" strokeWidth={3} />}
                </span>
                <span className="min-w-0">
                  <span className={`block text-[15px] leading-snug ${on ? "text-muted line-through decoration-faint" : ""}`}>{text}</span>
                  {why && !on && <span className="mt-0.5 block text-[12.5px] leading-snug text-faint">{why}</span>}
                </span>
              </button>
            </li>
          );
        })}
      </ul>
      <p className="mt-3 px-1 text-[12.5px] leading-snug text-faint">
        {es ? "Fuentes: " : "Sources: "}
        {PREP_SOURCES.map((s, i) => (
          <span key={s.url}>
            {i > 0 && " · "}
            <a href={s.url} target="_blank" rel="noopener noreferrer" className="underline">
              {s.name}
            </a>
          </span>
        ))}
      </p>
    </div>
  );
}

function Centers({ es }: { es: boolean }) {
  const { position } = useLocation();
  const { data } = useSWR<{ centers: Center[] }>("/api/storm/centers", fetcher, { revalidateOnFocus: false });
  const centers: Center[] = data?.centers ?? COOLING_CENTERS.map((c) => ({ ...c, lat: null, lng: null }));
  const withDistance = centers
    .map((c) => ({ ...c, mi: position && c.lat != null && c.lng != null ? distanceMiles(position, { lat: c.lat, lng: c.lng } as LatLng) : null }))
    .sort((a, b) => (a.mi ?? 1e9) - (b.mi ?? 1e9));

  return (
    <div className="pb-2">
      <div className="mb-3 flex items-start gap-3 rounded-[16px] bg-warn/12 px-3.5 py-3 text-[13.5px] leading-snug">
        <Phone className="mt-0.5 size-4 shrink-0 text-warn" aria-hidden />
        <p>
          {es
            ? "La Ciudad abre estos centros durante calor extremo y heladas. Los horarios cambian: llame al 311 para confirmar que esté abierto. Transporte gratis con METRO al llamar al 311."
            : "The City opens these as cooling centers in heat and warming centers in freezes. Hours change per event: call 311 to confirm one is open. Free rides via METRO by calling 311."}
          <a href="tel:311" className="ml-1 font-semibold text-text underline">
            311
          </a>
        </p>
      </div>
      <ul className="divide-y divide-line overflow-hidden rounded-[18px] bg-surface-2">
        {withDistance.map((c) => (
          <li key={c.id} className="flex items-center gap-3 px-4 py-3">
            <div className="min-w-0 flex-1">
              <p className="text-[15px] font-semibold leading-tight tracking-[-0.01em]">{c.name}</p>
              <p className="mt-0.5 text-[13px] text-muted">
                {c.address}, {c.zip}
                {c.mi != null && <span className="text-faint tnum"> · {formatDistance(c.mi)}</span>}
              </p>
            </div>
            <a
              href={`https://maps.apple.com/?daddr=${encodeURIComponent(`${c.address}, Houston, TX ${c.zip}`)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label={es ? `Cómo llegar a ${c.name}` : `Directions to ${c.name}`}
              className="press flex size-10 shrink-0 items-center justify-center rounded-full bg-surface-3 text-brand"
            >
              <Navigation className="size-[18px]" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <p className="mt-3 px-1 text-[12.5px] leading-snug text-faint">
        {es ? "Fuente: " : "Source: "}
        <a href={COOLING_SOURCE.url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
          {COOLING_SOURCE.name} <ExternalLink className="size-3" aria-hidden />
        </a>
      </p>
    </div>
  );
}
