"use client";

import { useState } from "react";
import { Bell, BellOff, LocateFixed, MapPin, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { usePlaces, useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import type { LatLng } from "@/lib/geo";
import type { PlaceKind, SavedPlace } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PLACE_ICONS, ResultRow, SearchInput, usePlaceSearch } from "@/components/map/SearchSheet";
import { Button } from "@/components/ui/Button";
import { Chip, Group } from "@/components/ui/Controls";
import { Sheet } from "@/components/ui/Sheet";
import { Skeleton } from "@/components/ui/States";
import { PlaceRulesSheet } from "./PlaceRulesSheet";

const KINDS: { id: PlaceKind; label: string; es: string }[] = [
  { id: "home", label: "Home", es: "Casa" },
  { id: "work", label: "Work", es: "Trabajo" },
  { id: "school", label: "School", es: "Escuela" },
  { id: "family", label: "Family", es: "Familia" },
  { id: "custom", label: "Custom", es: "Otro" },
];

export function PlacesSection() {
  const { places, max, isLoading, mutate } = usePlaces();
  const { viewer } = useViewer();
  const toast = useToast();
  const { es } = useT();
  const [adding, setAdding] = useState(false);
  const [rulesFor, setRulesFor] = useState<SavedPlace | null>(null);
  const atLimit = places.length >= max;

  async function toggleAlerts(p: SavedPlace) {
    try {
      await apiSend(`/api/places/${p.id}`, "PATCH", { alertsEnabled: !p.alertsEnabled });
      mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function remove(p: SavedPlace) {
    if (!window.confirm(es ? `¿Quitar ${p.label}?` : `Remove ${p.label}?`)) return;
    try {
      await apiSend(`/api/places/${p.id}`, "DELETE");
      mutate();
      toast(es ? `${p.label} quitado` : `${p.label} removed`, "success");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <>
      <Group
        id="places"
        title={`${es ? "Lugares guardados" : "Saved places"}${places.length === 0 ? "" : ` · ${places.length}/${max}`}`}
        action={
          // With no places yet, the "Add a place" row below is the only call to action.
          !atLimit && places.length > 0 && (
            <button onClick={() => setAdding(true)} className="press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[14px] font-medium text-brand">
              <Plus className="size-4" aria-hidden /> {es ? "Agregar" : "Add"}
            </button>
          )
        }
        footer={atLimit && viewer?.plan === "free" ? (es ? "Gratis incluye un lugar guardado." : "Free includes one saved place.") : undefined}
      >
        {isLoading ? (
          <div className="flex min-h-[60px] items-center gap-3.5 py-3" aria-busy="true" aria-label={es ? "Cargando lugares" : "Loading saved places"}>
            <Skeleton className="size-9 shrink-0 rounded-full" />
            <div className="flex-1 space-y-2">
              <Skeleton className="h-3.5 w-1/3" />
              <Skeleton className="h-3 w-2/3" />
            </div>
          </div>
        ) : places.length === 0 ? (
          <button onClick={() => setAdding(true)} className="flex min-h-[60px] w-full items-center gap-3.5 py-3 text-left active:opacity-60">
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-brand">
              <Plus className="size-[18px]" aria-hidden />
            </span>
            <span>
              <span className="block text-[16px] tracking-[-0.01em]">{es ? "Agregar un lugar" : "Add a place"}</span>
              <span className="block text-[13px] text-muted">{es ? "Reciba alertas cerca de Casa, Trabajo o Escuela" : "Get alerts near Home, Work or School"}</span>
            </span>
          </button>
        ) : (
          places.map((p) => {
            const Icon = PLACE_ICONS[p.kind];
            return (
              <div key={p.id} className="flex items-center gap-3.5 py-2.5">
                <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-text">
                  <Icon className="size-[18px]" aria-hidden />
                </span>
                <div className="min-w-0 flex-1">
                  <p className="truncate text-[16px] tracking-[-0.01em]">{p.label}</p>
                  <p className="truncate text-[13px] text-muted">
                    {p.radiusMi != null || p.categories != null
                      ? es
                        ? `${p.radiusMi != null ? `${p.radiusMi} mi` : "Radio normal"} · ${p.categories == null ? "categorías normales" : p.categories.length === 0 ? "todas las categorías" : `${p.categories.length} categorías`}`
                        : `${p.radiusMi != null ? `${p.radiusMi} mi` : "Default radius"} · ${p.categories == null ? "default" : p.categories.length === 0 ? "all" : p.categories.length} categories`
                      : p.address || (es ? "Ubicación marcada" : "Pinned location")}
                  </p>
                </div>
                {viewer?.limits.placeRules && (
                  <button
                    onClick={() => setRulesFor(p)}
                    aria-label={es ? `Reglas de alerta para ${p.label}` : `Alert rules for ${p.label}`}
                    className={`press inline-flex size-10 items-center justify-center rounded-full ${p.radiusMi != null || p.categories != null ? "text-gold" : "text-faint"}`}
                  >
                    <SlidersHorizontal className="size-[18px]" aria-hidden />
                  </button>
                )}
                <button
                  onClick={() => toggleAlerts(p)}
                  aria-label={p.alertsEnabled ? (es ? `Desactivar alertas de ${p.label}` : `Turn off alerts for ${p.label}`) : es ? `Activar alertas de ${p.label}` : `Turn on alerts for ${p.label}`}
                  aria-pressed={p.alertsEnabled}
                  className={`press inline-flex size-10 items-center justify-center rounded-full ${p.alertsEnabled ? "text-brand" : "text-faint"}`}
                >
                  {p.alertsEnabled ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
                </button>
                <button
                  onClick={() => remove(p)}
                  aria-label={es ? `Quitar ${p.label}` : `Remove ${p.label}`}
                  className="press -mr-2 inline-flex size-10 items-center justify-center rounded-full text-faint hover:text-danger"
                >
                  <Trash2 className="size-[18px]" aria-hidden />
                </button>
              </div>
            );
          })
        )}
      </Group>
      <AddPlaceSheet open={adding} onClose={() => setAdding(false)} usedKinds={places.map((p) => p.kind)} onAdded={() => mutate()} />
      <PlaceRulesSheet place={rulesFor} onClose={() => setRulesFor(null)} onSaved={() => mutate()} />
    </>
  );
}

function AddPlaceSheet({ open, onClose, usedKinds, onAdded }: { open: boolean; onClose: () => void; usedKinds: PlaceKind[]; onAdded: () => void }) {
  const toast = useToast();
  const { es } = useT();
  const { position, request } = useLocation();
  const firstFree = KINDS.find((k) => k.id === "custom" || !usedKinds.includes(k.id))!.id;
  const [kind, setKind] = useState<PlaceKind>(firstFree);
  const [label, setLabel] = useState("");
  const [q, setQ] = useState("");
  const [picked, setPicked] = useState<{ point: LatLng; address: string } | null>(null);
  const [busy, setBusy] = useState(false);
  const { results, searching } = usePlaceSearch(picked ? "" : q, position);

  const reset = () => {
    setLabel("");
    setQ("");
    setPicked(null);
    onClose();
  };

  async function save() {
    if (!picked) return;
    setBusy(true);
    try {
      const kindDef = KINDS.find((k) => k.id === kind)!;
      const name = label.trim() || (es ? kindDef.es : kindDef.label);
      await apiSend("/api/places", "POST", {
        kind,
        label: name,
        latitude: picked.point.lat,
        longitude: picked.point.lng,
        address: picked.address,
        alertsEnabled: true,
      });
      toast(es ? `${name} guardado. Recibirá alertas cerca.` : `${name} saved. You'll get alerts nearby.`, "success");
      onAdded();
      reset();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={reset}
      title={es ? "Agregar un lugar" : "Add a place"}
      footer={
        <Button block size="lg" onClick={save} loading={busy} disabled={!picked}>
          {es ? "Guardar lugar" : "Save place"}
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
            {es ? k.es : k.label}
          </Chip>
        ))}
      </div>
      {kind === "custom" || kind === "family" ? (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 40))}
          placeholder={kind === "family" ? (es ? "p. ej. Casa de mamá" : "e.g. Mom's place") : es ? "Nombre del lugar" : "Name this place"}
          aria-label={es ? "Nombre del lugar" : "Place name"}
          className="mt-3 h-12 w-full rounded-full bg-surface-2 px-4 text-[16px] outline-none ring-brand/60 transition placeholder:text-faint focus:ring-2"
        />
      ) : null}

      <div className="mt-4">
        {picked ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand/[0.08] px-4 py-3">
            <MapPin className="size-[18px] shrink-0 text-brand" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-[15px]">{picked.address || (es ? "Ubicación actual" : "Current location")}</p>
            <button onClick={() => setPicked(null)} className="min-h-11 px-2 text-[14px] font-medium text-brand">
              {es ? "Cambiar" : "Change"}
            </button>
          </div>
        ) : (
          <>
            <SearchInput value={q} onChange={setQ} placeholder={es ? "Buscar una dirección" : "Search an address"} />
            <ul className="mt-1 divide-y divide-line">
              <ResultRow
                title={es ? "Usar mi ubicación actual" : "Use my current location"}
                detail={position ? (es ? "Se guarda de forma aproximada" : "Saved approximately") : es ? "Permitir acceso a la ubicación" : "Allow location access"}
                icon={<LocateFixed className="size-[18px]" aria-hidden />}
                onClick={() => {
                  if (!position) {
                    request();
                    return;
                  }
                  setPicked({ point: { lat: position.lat, lng: position.lng }, address: es ? "Ubicación actual" : "Current location" });
                }}
              />
              {searching && <li className="py-3 text-[14px] text-faint">{es ? "Buscando…" : "Searching…"}</li>}
              {results.map((r) => (
                <ResultRow
                  key={r.id}
                  title={r.name}
                  detail={r.detail}
                  icon={<MapPin className="size-[18px]" aria-hidden />}
                  onClick={() => setPicked({ point: { lat: r.latitude, lng: r.longitude }, address: [r.name, r.detail].filter(Boolean).join(", ") })}
                />
              ))}
            </ul>
          </>
        )}
      </div>
      <p className="mt-3 pb-1 text-[12.5px] leading-snug text-faint">{es ? "Sus lugares guardados son privados y solo se usan para las alertas." : "Saved places are private to you and only used to match alerts."}</p>
    </Sheet>
  );
}
