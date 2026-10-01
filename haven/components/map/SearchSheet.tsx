"use client";

import { useEffect, useState } from "react";
import { Briefcase, GraduationCap, Heart, Home, MapPin, Search, Star, X } from "lucide-react";
import { useT } from "@/lib/client/lang";
import useSWR from "swr";
import { fetcher } from "@/lib/client/api";
import { usePlaces } from "@/lib/client/hooks";
import type { LatLng } from "@/lib/geo";
import type { PlaceKind } from "@/lib/types";
import { Sheet } from "@/components/ui/Sheet";
import { Spinner } from "@/components/ui/States";

export interface SearchResult {
  id: string;
  name: string;
  detail: string;
  latitude: number;
  longitude: number;
}

export const PLACE_ICONS: Record<PlaceKind, typeof Home> = {
  home: Home,
  work: Briefcase,
  school: GraduationCap,
  family: Heart,
  custom: Star,
};

/** Debounced place search shared by the map and "add place" flows. */
export function usePlaceSearch(query: string, near: LatLng | null) {
  const [debounced, setDebounced] = useState(query);
  useEffect(() => {
    const t = setTimeout(() => setDebounced(query.trim()), 400);
    return () => clearTimeout(t);
  }, [query]);
  const url =
    debounced.length >= 2
      ? `/api/geocode?q=${encodeURIComponent(debounced)}${near ? `&lat=${near.lat.toFixed(2)}&lng=${near.lng.toFixed(2)}` : ""}`
      : null;
  const { data, error, isLoading } = useSWR<{ results: SearchResult[] }>(url, fetcher, { revalidateOnFocus: false });
  return { results: data?.results ?? [], error, searching: isLoading || (query.trim() !== debounced && query.trim().length >= 2) };
}

export function SearchInput({
  value,
  onChange,
  autoFocus,
  placeholder,
}: {
  value: string;
  onChange: (v: string) => void;
  autoFocus?: boolean;
  placeholder?: string;
}) {
  const { es } = useT();
  placeholder ??= es ? "Buscar una dirección o lugar" : "Search an address or place";
  return (
    <label className="flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-brand/60 transition focus-within:ring-2">
      <Search className="size-[18px] text-muted" aria-hidden />
      <input
        type="search"
        inputMode="search"
        enterKeyHint="search"
        autoFocus={autoFocus}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        aria-label={placeholder}
        className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint [&::-webkit-search-cancel-button]:hidden"
      />
      {value && (
        <button onClick={() => onChange("")} aria-label={es ? "Borrar" : "Clear"} className="-mr-1.5 flex size-7 items-center justify-center rounded-full bg-white/10 text-muted">
          <X className="size-3.5" aria-hidden />
        </button>
      )}
    </label>
  );
}

export function ResultRow({ title, detail, icon, onClick }: { title: string; detail?: string; icon: React.ReactNode; onClick: () => void }) {
  return (
    <li>
      <button onClick={onClick} className="flex min-h-[54px] w-full items-center gap-3.5 py-2 text-left transition active:opacity-60">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-3 text-muted">{icon}</span>
        <span className="min-w-0">
          <span className="block truncate text-[15px]">{title}</span>
          {detail && <span className="block truncate text-[13px] text-muted">{detail}</span>}
        </span>
      </button>
    </li>
  );
}

export function SearchSheet({
  open,
  onClose,
  near,
  onPick,
}: {
  open: boolean;
  onClose: () => void;
  near: LatLng | null;
  onPick: (p: LatLng, label: string) => void;
}) {
  const [q, setQ] = useState("");
  const { results, error, searching } = usePlaceSearch(q, near);
  const { places } = usePlaces();
  const { es } = useT();

  const pick = (p: LatLng, label: string) => {
    onPick(p, label);
    setQ("");
    onClose();
  };

  return (
    <Sheet open={open} onClose={onClose} title={es ? "Buscar" : "Search"}>
      <SearchInput value={q} onChange={setQ} autoFocus />
      <div className="mt-2 min-h-[200px]">
        {q.trim().length < 2 ? (
          places.length > 0 ? (
            <>
              <p className="pb-1 pt-3 text-[13px] font-medium text-muted">{es ? "Lugares guardados" : "Saved places"}</p>
              <ul className="divide-y divide-line">
                {places.map((p) => {
                  const Icon = PLACE_ICONS[p.kind];
                  return (
                    <ResultRow
                      key={p.id}
                      title={p.label}
                      detail={p.address}
                      icon={<Icon className="size-[18px]" aria-hidden />}
                      onClick={() => pick({ lat: p.latitude, lng: p.longitude }, p.label)}
                    />
                  );
                })}
              </ul>
            </>
          ) : (
            <p className="py-8 text-center text-[14px] text-faint">{es ? "Busque un vecindario, calle o lugar conocido." : "Search for a neighborhood, street or landmark."}</p>
          )
        ) : searching ? (
          <div className="flex justify-center py-8 text-muted">
            <Spinner />
          </div>
        ) : error ? (
          <p className="py-8 text-center text-[14px] text-faint">{es ? "La búsqueda no está disponible ahora." : "Search is unavailable right now."}</p>
        ) : results.length === 0 ? (
          <p className="py-8 text-center text-[14px] text-faint">{es ? `No se encontraron lugares para “${q.trim()}”.` : `No places found for “${q.trim()}”.`}</p>
        ) : (
          <ul className="divide-y divide-line">
            {results.map((r) => (
              <ResultRow
                key={r.id}
                title={r.name}
                detail={r.detail}
                icon={<MapPin className="size-[18px]" aria-hidden />}
                onClick={() => pick({ lat: r.latitude, lng: r.longitude }, r.name)}
              />
            ))}
          </ul>
        )}
      </div>
      <p className="pb-2 pt-3 text-[11px] text-faint">{es ? "Búsqueda por OpenStreetMap Nominatim" : "Search by OpenStreetMap Nominatim"}</p>
    </Sheet>
  );
}
