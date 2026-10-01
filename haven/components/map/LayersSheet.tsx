"use client";

import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { MAPTILER_KEY, type MapMode } from "./map3d";

const MODES: { id: MapMode; label: string; detail: string; preview: string }[] = [
  {
    id: "auto",
    label: "Automatic",
    detail: "Day map in daylight, night map after dark",
    preview: "linear-gradient(135deg, #e9e4dc 0%, #e9e4dc 49%, #0b1524 51%, #1d2433 100%)",
  },
  {
    id: "night",
    label: "Night",
    detail: "Dark city with lit 3D buildings",
    preview: "radial-gradient(circle at 30% 30%, #33425f 0, #161a24 45%, #080a0f 100%)",
  },
  {
    id: "day",
    label: "Day",
    detail: "Bright streets, parks and water",
    preview: "radial-gradient(circle at 30% 30%, #ffffff 0, #e9e4dc 40%, #a9d3f5 100%)",
  },
  {
    id: "satellite",
    label: "Satellite",
    detail: MAPTILER_KEY ? "Aerial photos with street labels" : "Needs a MapTiler key in Vercel",
    preview: "radial-gradient(circle at 35% 35%, #6b7a4a 0, #3e4a2c 40%, #1c2a3a 100%)",
  },
];

export function LayersSheet({
  open,
  onClose,
  value,
  onChange,
}: {
  open: boolean;
  onClose: () => void;
  value: MapMode;
  onChange: (m: MapMode) => void;
}) {
  return (
    <Sheet open={open} onClose={onClose} title="Map style">
      <div className="grid grid-cols-2 gap-2.5 pb-2">
        {MODES.map((m) => {
          const disabled = m.id === "satellite" && !MAPTILER_KEY;
          const on = value === m.id;
          return (
            <button
              key={m.id}
              type="button"
              disabled={disabled}
              aria-pressed={on}
              onClick={() => {
                onChange(m.id);
                onClose();
              }}
              className={`press relative overflow-hidden rounded-card bg-surface-2 p-2 text-left disabled:opacity-50 ${
                on ? "ring-2 ring-brand" : ""
              }`}
            >
              <span className="block h-20 w-full rounded-[12px]" style={{ background: m.preview }} aria-hidden />
              <span className="mt-2 flex items-center gap-1.5 px-1 text-[15px] font-semibold">
                {m.label}
                {on && <Check className="size-4 text-brand" aria-hidden />}
              </span>
              <span className="block px-1 pb-1 text-[12.5px] leading-snug text-muted">{m.detail}</span>
            </button>
          );
        })}
      </div>
    </Sheet>
  );
}
