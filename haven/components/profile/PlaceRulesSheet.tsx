"use client";

import { useState } from "react";
import Link from "next/link";
import { CATEGORIES } from "@/lib/categories";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
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
  return (
    <Sheet open={Boolean(place)} onClose={onClose} title={place ? `Alerts near ${place.label}` : ""}>
      {place && <RulesForm key={place.id} place={place} onClose={onClose} onSaved={onSaved} />}
    </Sheet>
  );
}

function RulesForm({ place, onClose, onSaved }: { place: SavedPlace; onClose: () => void; onSaved: () => void }) {
  const toast = useToast();
  const { viewer } = useViewer();
  const allowed = viewer?.limits.placeRules ?? false;
  const maxRadius = viewer?.limits.maxAlertRadiusMi ?? 5;
  const [radius, setRadius] = useState<number | "default">(place.radiusMi ?? "default");
  const [cats, setCats] = useState<CategoryId[] | null>(place.categories);
  const [busy, setBusy] = useState(false);

  const toggle = (c: CategoryId) => {
    const current = cats ?? CATEGORIES.map((x) => x.id);
    const next = current.includes(c) ? current.filter((x) => x !== c) : [...current, c];
    setCats(next.length === CATEGORIES.length ? [] : next);
  };

  async function save() {
    setBusy(true);
    try {
      await apiSend(`/api/places/${place.id}`, "PATCH", {
        radiusMi: radius === "default" ? null : radius,
        categories: cats,
      });
      toast(`Rules for ${place.label} saved`, "success");
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
          With Lifetime, each place gets its own radius and categories. Keep Home wide and quiet, and Work tight and
          traffic-only.
        </p>
        <Link href="/upgrade" transitionTypes={["nav-forward"]} className="press mt-4 flex h-12 items-center justify-center rounded-2xl bg-gold text-[15px] font-semibold text-[#241a05]">
          See Haven Lifetime
        </Link>
      </div>
    );
  }

  return (
    <div className="pb-1">
      <p className="mb-2.5 text-[13px] font-medium text-muted">Radius</p>
      <Segmented
        label="Radius for this place"
        value={radius}
        onChange={setRadius}
        options={[
          { value: "default" as const, label: "Default" },
          ...RADIUS_OPTIONS_MI.map((r) => ({ value: r, label: `${r} mi`, locked: r > maxRadius })),
        ]}
      />
      <p className="mb-2.5 mt-5 text-[13px] font-medium text-muted">Categories</p>
      <div className="flex flex-wrap gap-2">
        <Chip active={cats === null} onClick={() => setCats(null)}>
          Default
        </Chip>
        <Chip active={cats !== null && cats.length === 0} onClick={() => setCats([])}>
          All
        </Chip>
        {CATEGORIES.map((c) => (
          <Chip key={c.id} active={cats !== null && cats.length > 0 && cats.includes(c.id)} onClick={() => toggle(c.id)}>
            {c.short}
          </Chip>
        ))}
      </div>
      <p className="mt-3 text-[12.5px] leading-snug text-faint">“Default” follows your account-wide alert settings.</p>
      <Button block size="lg" className="mt-5" onClick={save} loading={busy}>
        Save
      </Button>
    </div>
  );
}
