"use client";

import { useState } from "react";
import { Bell, BellOff, LocateFixed, MapPin, Plus, SlidersHorizontal, Trash2 } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { usePlaces, useViewer } from "@/lib/client/hooks";
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

const KINDS: { id: PlaceKind; label: string }[] = [
  { id: "home", label: "Home" },
  { id: "work", label: "Work" },
  { id: "school", label: "School" },
  { id: "family", label: "Family" },
  { id: "custom", label: "Custom" },
];

export function PlacesSection() {
  const { places, max, isLoading, mutate } = usePlaces();
  const { viewer } = useViewer();
  const toast = useToast();
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
    if (!window.confirm(`Remove ${p.label}?`)) return;
    try {
      await apiSend(`/api/places/${p.id}`, "DELETE");
      mutate();
      toast(`${p.label} removed`, "success");
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  return (
    <>
      <Group
        id="places"
        title={`Saved places · ${places.length}/${max}`}
        action={
          !atLimit && (
            <button onClick={() => setAdding(true)} className="press inline-flex min-h-11 items-center gap-1 rounded-full px-2 text-[14px] font-medium text-brand">
              <Plus className="size-4" aria-hidden /> Add
            </button>
          )
        }
        footer={
          atLimit && viewer?.plan === "free" ? (
            <>
              Free includes one saved place.{" "}
              <a href="/upgrade" className="text-gold">
                Lifetime saves up to 10.
              </a>
            </>
          ) : undefined
        }
      >
        {isLoading ? (
          <div className="py-4">
            <Skeleton className="h-10 w-full" />
          </div>
        ) : places.length === 0 ? (
          <button onClick={() => setAdding(true)} className="flex min-h-[60px] w-full items-center gap-3.5 py-3 text-left active:opacity-60">
            <span className="flex size-9 items-center justify-center rounded-full bg-surface-3 text-brand">
              <Plus className="size-[18px]" aria-hidden />
            </span>
            <span>
              <span className="block text-[16px] tracking-[-0.01em]">Add a place</span>
              <span className="block text-[13px] text-muted">Get alerts near Home, Work or School</span>
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
                      ? `${p.radiusMi != null ? `${p.radiusMi} mi` : "Default radius"} · ${p.categories == null ? "default" : p.categories.length === 0 ? "all" : p.categories.length} categories`
                      : p.address || "Pinned location"}
                  </p>
                </div>
                <button
                  onClick={() => setRulesFor(p)}
                  aria-label={`Alert rules for ${p.label}`}
                  className={`press inline-flex size-10 items-center justify-center rounded-full ${p.radiusMi != null || p.categories != null ? "text-gold" : "text-faint"}`}
                >
                  <SlidersHorizontal className="size-[18px]" aria-hidden />
                </button>
                <button
                  onClick={() => toggleAlerts(p)}
                  aria-label={p.alertsEnabled ? `Turn off alerts for ${p.label}` : `Turn on alerts for ${p.label}`}
                  aria-pressed={p.alertsEnabled}
                  className={`press inline-flex size-10 items-center justify-center rounded-full ${p.alertsEnabled ? "text-brand" : "text-faint"}`}
                >
                  {p.alertsEnabled ? <Bell className="size-5" aria-hidden /> : <BellOff className="size-5" aria-hidden />}
                </button>
                <button
                  onClick={() => remove(p)}
                  aria-label={`Remove ${p.label}`}
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
      const name = label.trim() || KINDS.find((k) => k.id === kind)!.label;
      await apiSend("/api/places", "POST", {
        kind,
        label: name,
        latitude: picked.point.lat,
        longitude: picked.point.lng,
        address: picked.address,
        alertsEnabled: true,
      });
      toast(`${name} saved. You'll get alerts nearby.`, "success");
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
      title="Add a place"
      footer={
        <Button block size="lg" onClick={save} loading={busy} disabled={!picked}>
          Save place
        </Button>
      }
    >
      <div className="flex flex-wrap gap-2">
        {KINDS.map((k) => (
          <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
            {k.label}
          </Chip>
        ))}
      </div>
      {kind === "custom" || kind === "family" ? (
        <input
          value={label}
          onChange={(e) => setLabel(e.target.value.slice(0, 40))}
          placeholder={kind === "family" ? "e.g. Mom's place" : "Name this place"}
          aria-label="Place name"
          className="mt-3 h-12 w-full rounded-full bg-surface-2 px-4 text-[16px] outline-none ring-brand/60 transition placeholder:text-faint focus:ring-2"
        />
      ) : null}

      <div className="mt-4">
        {picked ? (
          <div className="flex items-center gap-3 rounded-2xl bg-brand/[0.08] px-4 py-3">
            <MapPin className="size-[18px] shrink-0 text-brand" aria-hidden />
            <p className="min-w-0 flex-1 truncate text-[15px]">{picked.address || "Current location"}</p>
            <button onClick={() => setPicked(null)} className="min-h-11 px-2 text-[14px] font-medium text-brand">
              Change
            </button>
          </div>
        ) : (
          <>
            <SearchInput value={q} onChange={setQ} placeholder="Search an address" />
            <ul className="mt-1 divide-y divide-line">
              <ResultRow
                title="Use my current location"
                detail={position ? "Saved approximately" : "Allow location access"}
                icon={<LocateFixed className="size-[18px]" aria-hidden />}
                onClick={() => {
                  if (!position) {
                    request();
                    return;
                  }
                  setPicked({ point: { lat: position.lat, lng: position.lng }, address: "Current location" });
                }}
              />
              {searching && <li className="py-3 text-[14px] text-faint">Searching…</li>}
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
      <p className="mt-3 pb-1 text-[12.5px] leading-snug text-faint">Saved places are private to you and only used to match alerts.</p>
    </Sheet>
  );
}
