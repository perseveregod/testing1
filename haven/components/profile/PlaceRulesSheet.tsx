"use client";

import { useState } from "react";
import Link from "next/link";
import { EVERYDAY_CATEGORIES } from "@/lib/categories";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { RADIUS_OPTIONS_MI } from "@/lib/plans";
import type { CategoryId, SavedPlace } from "@/lib/types";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Chip, Segmented } from "@/components/ui/Controls";
import { Sheet } from "@/components/ui/Sheet";

/** Lifetime: a saved place's own alert radius and categories. */
export function PlaceRulesSheet({
  place,
  onClose,
  onSaved,
}: {
  place: SavedPlace | null;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { es } = useT();
  return (
    <Sheet open={Boolean(place)} onClose={onClose} title={place ? (es ? `Alertas cerca de ${place.label}` : `Alerts near ${place.label}`) : ""}>
      {place && <RulesForm key={place.id} place={place} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function RulesForm({ place, onClose, onSaved }: { place: SavedPlace; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { es, cat } = useT();
  const { viewer } = useViewer();
  const allowed = viewer?.limits.placeRules ?? false;
  const maxRadius = viewer?.limits.maxAlertRadiusMi ?? 5;
  const [radius, setRadius] = useState<number | "default">(place.radiusMi ?? "default");
  const [cats, setCats] = useState<CategoryId[] | null>(place.categories);
  const [busy, setBusy] = useState(false);

  const toggle = (c: CategoryId) => {
    const current = cats ?? EVERYDAY_CATEGORIES.map((x) => x.id);
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    setCats(next.length === EVERYDAY_CATEGORIES.length ? [] : next);
  };

  async function save() {
    setBusy(true);
    try {
      await apiSend(`/api/places/${place.id}`, "PATCH", {
        radiusMi: radius === "default" ? null : radius,
        categories: cats,
      });
      toast(es ? `Reglas de ${place.label} guardadas` : `Rules for ${place.label} saved`, "success");
      onSaved();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  if (!allowed) {
    return (
      <div className="pb-2">
        <p className="text-[15px] leading-relaxed text-muted">
          {es
            ? "Con De por vida, cada lugar tiene su propio radio y categorías. Casa amplia y tranquila; Trabajo cerrado y solo tráfico."
            : "With Lifetime, each place gets its own radius and categories. Keep Home wide and quiet, and Work tight and traffic-only."}
        </p>
        <Link href="/upgrade" transitionTypes={["nav-forward"]} className="press mt-4 flex h-12 items-center justify-center rounded-2xl bg-gold text-[15px] font-semibold text-[#241a05]">
          {es ? "Ver Haven de por vida" : "See Haven Lifetime"}
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-1">
      <p className="mb-2.5 text-[13px] font-medium text-muted">{es ? "Radio" : "Radius"}</p>
      <Segmented
        label={es ? "Radio para este lugar" : "Radius for this place"}
        value={radius}
        onChange={setRadius}
        options={[
          { value: "default" as const, label: es ? "Normal" : "Default" },
          ...RADIUS_OPTIONS_MI.map((r) => ({ value: r, label: `${r} mi`, locked: r > maxRadius })),
        ]}
      />
      <p className="mb-2.5 mt-5 text-[13px] font-medium text-muted">{es ? "Categorías" : "Categories"}</p>
      <div className="flex flex-wrap gap-2">
        <Chip active={cats === null} onClick={() => setCats(null)}>
          {es ? "Normal" : "Default"}
        </Chip>
        <Chip active={cats !== null && cats.length === 0} onClick={() => setCats([])}>
          {es ? "Todas" : "All"}
        </Chip>
        {EVERYDAY_CATEGORIES.map((c) => (
          <Chip key={c.id} active={cats !== null && cats.length > 0 && cats.includes(c.id)} onClick={() => toggle(c.id)}>
            {cat(c.id).short}
          </Chip>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-faint">{es ? "“Normal” sigue los ajustes de alerta de su cuenta." : "“Default” follows your account-wide alert settings."}</p>
      <Button block size="lg" className="mt-5" onClick={save} loading={busy}>
        {es ? "Guardar" : "Save"}
      </Button>
    </div>
  );
}
