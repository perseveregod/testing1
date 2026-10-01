"use client";

import { Check } from "lucide-react";
import { Sheet } from "@/components/ui/Sheet";
import { Toggle } from "@/components/ui/Controls";
import { useT } from "@/lib/client/lang";
import { setLayerPrefs, useLayerPrefs } from "@/lib/client/layers";
import type { Key } from "@/lib/i18n";
import { MAPTILER_KEY, type MapMode } from "./map3d";

const MODES: { id: MapMode; label: Key; detail: Key; preview: string }[] = [
  {
    id: "auto",
    label: "layers.auto",
    detail: "layers.autoBody",
    preview: "linear-gradient(135deg, #e9e4dc 0%, #e9e4dc 49%, #0b1524 51%, #1d2433 100%)",
  },
  {
    id: "night",
    label: "layers.night",
    detail: "layers.nightBody",
    preview: "radial-gradient(circle at 30% 30%, #33425f 0, #161a24 45%, #080a0f 100%)",
  },
  {
    id: "day",
    label: "layers.day",
    detail: "layers.dayBody",
    preview: "radial-gradient(circle at 30% 30%, #ffffff 0, #e9e4dc 40%, #a9d3f5 100%)",
  },
  {
    id: "satellite",
    label: "layers.satellite",
    detail: MAPTILER_KEY ? "layers.satelliteBody" : "layers.satelliteKey",
    preview: "radial-gradient(circle at 35% 35%, #6b7a4a 0, #3e4a2c 40%, #1c2a3a 100%)",
  },
];

export function LayersSheet({
  open,
  onClose,
  value,
  onChange,
  tilted,
  onToggle3D,
}: {
  open: boolean;
  onClose: () => void;
  value: MapMode;
  onChange: (m: MapMode) => void;
  tilted?: boolean;
  onToggle3D?: () => void;
}) {
  const layers = useLayerPrefs();
  const { t, es } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={t("layers.title")}>
      {onToggle3D && (
        <div className="mb-3 flex overflow-hidden rounded-[14px] bg-surface-2 p-[3px]" role="radiogroup" aria-label={t("layers.view")}>
          {(["2D", "3D"] as const).map((v) => {
            const on = (v === "3D") === Boolean(tilted);
            return (
              <button
                key={v}
                role="radio"
                aria-checked={on}
                onClick={() => {
                  if (!on) onToggle3D();
                }}
                className={`flex min-h-11 flex-1 items-center justify-center rounded-[11px] text-[14px] font-semibold ${
                  on ? "bg-surface-3 text-text shadow-[0_1px_3px_rgba(0,0,0,0.4)]" : "text-muted"
                }`}
              >
                {v === "2D" ? t("layers.flat") : t("layers.3d")}
              </button>
            );
          })}
        </div>
      )}
      <div className="grid grid-cols-2 gap-2.5">
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
                {t(m.label)}
                {on && <Check className="size-4 text-brand" aria-hidden />}
              </span>
              <span className="block px-1 pb-1 text-[12.5px] leading-snug text-muted">{t(m.detail)}</span>
            </button>
          );
        })}
      </div>
      <div className="mt-4 overflow-hidden rounded-[18px] bg-surface-2">
        <Toggle
          checked={layers.cameras}
          onChange={(v) => setLayerPrefs({ cameras: v })}
          label={t("layers.cameras")}
          description={t("layers.camerasBody")}
        />
      </div>
      <p className="mt-2 px-1 pb-2 text-[12px] leading-snug text-faint">
        {es
          ? "Ubicaciones de cámaras © colaboradores de OpenStreetMap, vía el proyecto DeFlock. Mapeado por voluntarios: faltan algunas y otras pueden haberse movido."
          : "Camera locations © OpenStreetMap contributors, via the DeFlock project. Volunteer-mapped: some are missing, a few may have moved."}
      </p>
    </Sheet>
  );
}
