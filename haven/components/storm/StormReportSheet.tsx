"use client";

import { useMemo, useRef, useState } from "react";
import { Camera, LocateFixed, MapPin, X } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { preparePhoto, useStormPrefs } from "@/lib/client/stormMode";
import { MAX_DESCRIPTION } from "@/lib/moderation";
import { PLACE_TYPES, placeLabel, STATE_STYLE, stateLabel, STATES_FOR, strings, type StormKind } from "@/lib/storm";
import type { LatLng } from "@/lib/geo";
import type { StormPlaceType, StormState } from "@/lib/types";
import { CategoryGlyph } from "@/components/incident/AnimatedIcons";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

/**
 * Storm reports in a couple of taps: pick what you see, send. Goes through
 * the same /api/reports endpoint (rate limits, moderation, block snapping)
 * as every other Haven report.
 */
export function StormReportSheet({
  open,
  onClose,
  mapCenter,
  myPosition,
  onSent,
}: {
  open: boolean;
  onClose: () => void;
  mapCenter: LatLng | null;
  myPosition: LatLng | null;
  onSent: (id: string) => void;
}) {
  const { lang } = useStormPrefs();
  const t = strings(lang);
  const toast = useToast();
  const [kind, setKind] = useState<StormKind | null>(null);
  const [state, setState] = useState<StormState | null>(null);
  const [placeType, setPlaceType] = useState<StormPlaceType | null>(null);
  const [note, setNote] = useState("");
  const [photo, setPhoto] = useState<string | null>(null);
  const [useMe, setUseMe] = useState(true);
  const [busy, setBusy] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const requestId = useMemo(() => (open ? crypto.randomUUID() : ""), [open]);

  const where = useMe && myPosition ? myPosition : mapCenter;
  const ready = kind != null && state != null && (kind !== "place" || placeType != null) && where != null;

  function reset() {
    setKind(null);
    setState(null);
    setPlaceType(null);
    setNote("");
    setPhoto(null);
  }

  async function pickPhoto(file: File | undefined) {
    if (!file) return;
    try {
      setPhoto(await preparePhoto(file));
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function send() {
    if (!ready || !where) return;
    setBusy(true);
    try {
      const r = await apiSend<{ incidentId: string }>("/api/reports", "POST", {
        category: kind,
        latitude: where.lat,
        longitude: where.lng,
        description: note.trim(),
        storm: { state, placeType: kind === "place" ? placeType : null },
        ...(photo ? { photo } : {}),
        clientRequestId: requestId,
      });
      toast(t.sent, "success");
      reset();
      onSent(r.incidentId);
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t.reportTitle}
      footer={
        <Button block size="lg" onClick={send} loading={busy} disabled={!ready}>
          {t.send}
        </Button>
      }
    >
      <div className="space-y-4 pb-1">
        {(["power", "flooding", "place"] as StormKind[]).map((k) => (
          <section key={k}>
            <p className="mb-2 flex items-center gap-2 text-[13px] font-bold text-text/90">
              <span className="flex size-7 items-center justify-center rounded-full bg-surface-2">
                <CategoryGlyph category={k} animated={false} className="size-4" />
              </span>
              {t[`kind_${k}`]}
            </p>
            {k === "place" && (
              <div className="no-scrollbar -mx-5 mb-2 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label={t.whichPlace}>
                {PLACE_TYPES.map((p) => (
                  <button
                    key={p}
                    role="radio"
                    aria-checked={placeType === p}
                    onClick={() => {
                      setKind("place");
                      setPlaceType(p);
                      if (kind !== "place") setState(null);
                    }}
                    className={`press inline-flex min-h-11 shrink-0 items-center rounded-full px-3.5 text-[13px] font-semibold ${
                      placeType === p && kind === "place" ? "bg-text text-bg" : "bg-surface-2 text-text"
                    }`}
                  >
                    {placeLabel(p, lang)}
                  </button>
                ))}
              </div>
            )}
            <div className="grid grid-cols-2 gap-2" role="radiogroup" aria-label={t[`kind_${k}`]}>
              {STATES_FOR[k].map((s) => {
                const on = kind === k && state === s;
                const style = STATE_STYLE[s];
                return (
                  <button
                    key={s}
                    role="radio"
                    aria-checked={on}
                    onClick={() => {
                      if (kind !== k) setPlaceType(k === "place" ? placeType : null);
                      setKind(k);
                      setState(s);
                    }}
                    className="press relative flex min-h-[76px] flex-col items-start justify-between overflow-hidden rounded-card p-3 text-left transition-[background-color,box-shadow] duration-150"
                    style={{
                      background: on ? style.color : "var(--surface-2)",
                      color: on ? (s === "closed" || s === "flooded" ? "#fff" : "#0b0c0f") : "var(--text)",
                      boxShadow: on ? `0 8px 22px -8px ${style.color}` : "inset 0 0 0 1px rgba(255,255,255,0.06)",
                    }}
                  >
                    <span
                      className="flex size-7 items-center justify-center rounded-full text-[13px] font-black leading-none"
                      style={{
                        background: on ? "rgba(255,255,255,0.28)" : `color-mix(in srgb, ${style.color} 22%, transparent)`,
                        color: on ? "inherit" : style.color,
                      }}
                      aria-hidden
                    >
                      {style.bad ? "✕" : "✓"}
                    </span>
                    <span className="mt-2 text-[15px] font-bold leading-tight tracking-[-0.01em]">{stateLabel(s, lang)}</span>
                  </button>
                );
              })}
            </div>
          </section>
        ))}

        <section className="rounded-card bg-surface-2 p-3">
          <p className="text-[12px] font-semibold text-muted">{t.reportAt}</p>
          <div className="mt-2 flex gap-2">
            <button
              onClick={() => setUseMe(true)}
              disabled={!myPosition}
              aria-pressed={useMe && Boolean(myPosition)}
              className={`press inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold disabled:opacity-40 ${
                useMe && myPosition ? "bg-text text-bg" : "bg-surface-3"
              }`}
            >
              <LocateFixed className="size-4" aria-hidden /> {t.useMe}
            </button>
            <button
              onClick={() => setUseMe(false)}
              aria-pressed={!useMe || !myPosition}
              className={`press inline-flex min-h-11 flex-1 items-center justify-center gap-1.5 rounded-full text-[13px] font-semibold ${
                !useMe || !myPosition ? "bg-text text-bg" : "bg-surface-3"
              }`}
            >
              <MapPin className="size-4" aria-hidden /> {t.useMap}
            </button>
          </div>
          <p className="mt-2 text-[12px] leading-snug text-faint">{t.reportWhere}</p>
        </section>

        <label className="block">
          <span className="sr-only">{t.note}</span>
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value.slice(0, MAX_DESCRIPTION))}
            rows={2}
            placeholder={t.note}
            className="w-full resize-none rounded-card bg-surface-2 p-3.5 text-[16px] outline-none ring-brand/60 placeholder:text-faint focus:ring-2"
          />
        </label>

        <div className="flex items-center gap-3">
          {photo ? (
            <div className="relative">
              {/* eslint-disable-next-line @next/next/no-img-element -- local data URL preview */}
              <img src={photo} alt="" className="size-20 rounded-control object-cover" />
              <button
                onClick={() => setPhoto(null)}
                aria-label={t.removePhoto}
                className="press absolute -right-2 -top-2 flex size-8 items-center justify-center rounded-full bg-black/80 text-white"
              >
                <X className="size-4" aria-hidden />
              </button>
            </div>
          ) : (
            <button
              onClick={() => fileRef.current?.click()}
              className="press inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-2 px-4 text-[14px] font-semibold"
            >
              <Camera className="size-4" aria-hidden /> {t.photo}
            </button>
          )}
          <p className="text-[12px] text-faint">{t.photoHint}</p>
          <input
            ref={fileRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={(e) => {
              void pickPhoto(e.target.files?.[0]);
              e.target.value = "";
            }}
          />
        </div>
      </div>
    </Sheet>
  );
}
