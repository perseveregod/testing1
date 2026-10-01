"use client";

import { useMemo, useState } from "react";
import { MapPin, Search } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { COMMUNITY_LIMITS, EVENT_KINDS, type CommunityEvent, type EventKind } from "@/lib/community";
import type { LatLng } from "@/lib/geo";
import { MiniMap } from "@/components/map/MiniMap";
import { SearchSheet } from "@/components/map/SearchSheet";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

/** Posting an event: what, when, where. Same moderation and limits as reports. */
export function NewEventSheet({
  open,
  onClose,
  near,
  onCreated,
}: {
  open: boolean;
  onClose: () => void;
  near: LatLng;
  onCreated: (e: CommunityEvent) => void;
}) {
  const toast = useToast();
  const [kind, setKind] = useState<EventKind>("community_day");
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [date, setDate] = useState(() => defaultDate());
  const [start, setStart] = useState("11:00");
  const [end, setEnd] = useState("");
  const [placeName, setPlaceName] = useState("");
  const [point, setPoint] = useState<LatLng | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [searchOpen, setSearchOpen] = useState(false);
  const [busy, setBusy] = useState(false);
  const requestId = useMemo(() => (open ? crypto.randomUUID() : ""), [open]);

  const startsAt = toIso(date, start);
  const endsAt = end ? toIso(date, end) : null;
  const ready = title.trim().length >= 3 && placeName.trim().length >= 2 && startsAt != null && (point ?? near) != null;

  function reset() {
    setTitle("");
    setDescription("");
    setEnd("");
    setPlaceName("");
    setPoint(null);
  }

  async function submit() {
    if (!ready || !startsAt) return;
    setBusy(true);
    try {
      const where = point ?? near;
      const r = await apiSend<{ event: CommunityEvent }>("/api/community/events", "POST", {
        kind,
        title: title.trim(),
        description: description.trim(),
        startsAt,
        endsAt,
        placeName: placeName.trim(),
        latitude: where.lat,
        longitude: where.lng,
        clientRequestId: requestId,
      });
      toast("Posted. Neighbors nearby can see it now.", "success");
      reset();
      onCreated(r.event);
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const field =
    "w-full rounded-2xl bg-surface-2 px-3.5 py-3 text-[16px] outline-none ring-brand/60 placeholder:text-faint focus:ring-2";

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Post an event"
      footer={
        <Button block size="lg" onClick={submit} loading={busy} disabled={!ready}>
          Post to the board
        </Button>
      }
    >
      <div className="space-y-4 pb-1">
        <div className="no-scrollbar -mx-5 flex gap-2 overflow-x-auto px-5" role="radiogroup" aria-label="Kind of event">
          {EVENT_KINDS.map((k) => (
            <button
              key={k.id}
              role="radio"
              aria-checked={kind === k.id}
              onClick={() => setKind(k.id)}
              className={`press inline-flex min-h-11 shrink-0 items-center gap-1.5 rounded-full px-3.5 text-[13.5px] font-semibold ${
                kind === k.id ? "bg-text text-bg" : "bg-surface-2 text-text"
              }`}
            >
              <span className="size-2 rounded-full" style={{ background: k.color }} aria-hidden />
              {k.label}
            </button>
          ))}
        </div>

        <label className="block">
          <span className="sr-only">Event name</span>
          <input
            value={title}
            onChange={(e) => setTitle(e.target.value.slice(0, COMMUNITY_LIMITS.title))}
            placeholder="Event name, e.g. Northside Community Day"
            className={field}
            autoComplete="off"
          />
        </label>

        <div className="grid grid-cols-[1.4fr_1fr_1fr] gap-2">
          <label className="block">
            <span className="mb-1 block px-1 text-[12.5px] font-semibold text-muted">Date</span>
            <input type="date" value={date} min={defaultDate()} onChange={(e) => setDate(e.target.value)} className={`${field} tnum`} />
          </label>
          <label className="block">
            <span className="mb-1 block px-1 text-[12.5px] font-semibold text-muted">Starts</span>
            <input type="time" value={start} onChange={(e) => setStart(e.target.value)} className={`${field} tnum`} />
          </label>
          <label className="block">
            <span className="mb-1 block px-1 text-[12.5px] font-semibold text-muted">Ends</span>
            <input type="time" value={end} onChange={(e) => setEnd(e.target.value)} className={`${field} tnum`} />
          </label>
        </div>

        <div>
          <span className="mb-1 block px-1 text-[12.5px] font-semibold text-muted">Where</span>
          <div className="flex gap-2">
            <label className="block min-w-0 flex-1">
              <span className="sr-only">Place name</span>
              <input
                value={placeName}
                onChange={(e) => setPlaceName(e.target.value.slice(0, COMMUNITY_LIMITS.placeName))}
                placeholder="Park, center or street, e.g. Moody Park"
                className={field}
                autoComplete="off"
              />
            </label>
            <button
              onClick={() => setSearchOpen(true)}
              aria-label="Search for the place on the map"
              className="press flex size-12 shrink-0 items-center justify-center rounded-2xl bg-surface-2 text-brand"
            >
              <Search className="size-5" aria-hidden />
            </button>
          </div>
          <MiniMap
            mode="picker"
            center={point ?? near}
            recenterKey={recenter}
            color="#FF9F0A"
            onChange={setPoint}
            className="mt-2 h-44 overflow-hidden rounded-2xl"
            label="Map to place the event. Drag to move the pin."
            attribution={false}
          />
          <p className="mt-1.5 flex items-start gap-1.5 text-[12.5px] leading-snug text-faint">
            <MapPin className="mt-0.5 size-3.5 shrink-0" aria-hidden />
            <span>Rounded to about 100 m. Use a public place, not someone&apos;s home.</span>
          </p>
        </div>

        <label className="block">
          <span className="sr-only">Details</span>
          <textarea
            value={description}
            onChange={(e) => setDescription(e.target.value.slice(0, COMMUNITY_LIMITS.description))}
            rows={3}
            placeholder="What to expect, what to bring, who it's for. No phone numbers or links."
            className={`${field} resize-none`}
          />
        </label>
      </div>

      <SearchSheet
        open={searchOpen}
        onClose={() => setSearchOpen(false)}
        near={near}
        onPick={(p, label) => {
          setPoint(p);
          setRecenter((n) => n + 1);
          if (!placeName.trim()) setPlaceName(label.split(",")[0]!.slice(0, COMMUNITY_LIMITS.placeName));
        }}
      />
    </Sheet>
  );
}

function defaultDate() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function toIso(date: string, time: string): string | null {
  if (!date || !time) return null;
  const d = new Date(`${date}T${time}`);
  return Number.isNaN(d.getTime()) ? null : d.toISOString();
}
