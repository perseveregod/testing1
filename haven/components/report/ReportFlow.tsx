"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import useSWR from "swr";
import { Check, ChevronLeft, Layers, LocateFixed, X } from "lucide-react";
import { EVERYDAY_CATEGORIES, categoriesInGroup, getCategory } from "@/lib/categories";
import { apiSend, ApiClientError, errorMessage, fetcher } from "@/lib/client/api";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { useIncidents } from "@/lib/client/hooks";
import type { LatLng } from "@/lib/geo";
import { MAX_DESCRIPTION } from "@/lib/moderation";
import type { CategoryId } from "@/lib/types";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { EmergencyNote } from "@/components/EmergencyNote";
import { MiniMap } from "@/components/map/MiniMap";
import { Button, ButtonLink } from "@/components/ui/Button";

type Step = 1 | 2 | 3 | 4 | 5;
const STEP_TITLES: Record<Exclude<Step, 5>, string> = {
  1: "What's happening?",
  2: "Where is it?",
  3: "Add details",
  4: "Review",
};

interface Result {
  incidentId: string;
  merged: boolean;
  redacted: boolean;
}

function newRequestId() {
  return typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `${Date.now()}-${Math.random().toString(36).slice(2)}`;
}

export function ReportFlow() {
  const router = useRouter();
  const toast = useToast();
  const { position, request, status } = useLocation();
  const [step, setStep] = useState<Step>(1);
  const [category, setCategory] = useState<CategoryId | null>(null);
  const [point, setPoint] = useState<LatLng | null>(null);
  const [recenter, setRecenter] = useState(0);
  const [description, setDescription] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [result, setResult] = useState<Result | null>(null);
  const [requestId] = useState(newRequestId);

  const start = point ?? position ?? DEFAULT_CENTER;

  // Ask for location up front: it makes step 2 a single tap.
  useEffect(() => {
    if (status === "prompt") request();
  }, [status, request]);

  // If GPS arrives after the picker opened, move the pin there once.
  const autoCentered = useRef(false);
  useEffect(() => {
    if (step !== 2 || autoCentered.current || !position) return;
    autoCentered.current = true;
    setPoint(position);
    setRecenter((n) => n + 1);
  }, [step, position]);

  const close = () => (window.history.length > 1 ? router.back() : router.push("/"));
  const back = () => setStep((s) => (s > 1 ? ((s - 1) as Step) : s));

  async function submit() {
    if (!category || !point) return;
    setSubmitting(true);
    try {
      const r = await apiSend<Result>("/api/reports", "POST", {
        category,
        latitude: point.lat,
        longitude: point.lng,
        description: description.trim(),
        clientRequestId: requestId,
      });
      setResult(r);
      setStep(5);
    } catch (err) {
      const msg = errorMessage(err);
      toast(msg, "error");
      if (err instanceof ApiClientError && err.code === "moderation") setStep(3);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <main className="flex min-h-dvh flex-col">
      {step < 5 && (
        <header className="glass-bar sticky top-0 z-20" style={{ paddingTop: "var(--safe-top)" }}>
          <div className="mx-auto flex h-12 max-w-lg items-center px-2">
            {step > 1 ? (
              <button onClick={back} aria-label="Previous step" className="press inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
                <ChevronLeft className="size-[26px]" strokeWidth={2.2} aria-hidden />
              </button>
            ) : (
              <span className="size-11" />
            )}
            <p className="flex-1 text-center text-[13px] font-medium text-muted tnum">Step {step} of 4</p>
            <button onClick={close} aria-label="Cancel report" className="press inline-flex size-11 items-center justify-center rounded-full hover:bg-surface-2">
              <X className="size-[22px]" aria-hidden />
            </button>
          </div>
          <div className="mx-auto h-[3px] max-w-lg px-5" aria-hidden>
            <div className="h-full overflow-hidden rounded-full bg-surface-3">
              <div className="h-full rounded-full bg-text transition-[width] duration-500 ease-[var(--ease-out)]" style={{ width: `${(step / 4) * 100}%` }} />
            </div>
          </div>
          <h1 className="mx-auto max-w-lg px-5 pb-3 pt-4 text-[26px] font-bold tracking-[-0.025em]">{STEP_TITLES[step as keyof typeof STEP_TITLES]}</h1>
        </header>
      )}

      <div className="mx-auto flex w-full max-w-lg flex-1 flex-col px-5">
        {step === 1 && (
          <StepCategory
            value={category}
            onPick={(c) => {
              setCategory(c);
              setStep(2);
            }}
          />
        )}

        {step === 2 && category && (
          <StepLocation
            start={start}
            recenterKey={recenter}
            category={category}
            point={point}
            onChange={setPoint}
            hasPosition={Boolean(position)}
            onUseMyLocation={() => {
              if (position) {
                setPoint(position);
                setRecenter((n) => n + 1);
              } else request();
            }}
            onNext={() => {
              if (!point) setPoint(start);
              setStep(3);
            }}
          />
        )}

        {step === 3 && <StepDetails category={category!} value={description} onChange={setDescription} onNext={() => setStep(4)} />}

        {step === 4 && category && point && (
          <StepReview category={category} point={point} description={description} submitting={submitting} onEdit={(s) => setStep(s)} onSubmit={submit} />
        )}

        {step === 5 && result && <StepDone result={result} />}
      </div>
    </main>
  );
}

function StickyFooter({ children }: { children: React.ReactNode }) {
  return (
    <div className="sticky bottom-0 -mx-5 mt-auto bg-gradient-to-t from-bg via-bg/95 to-bg/0 px-5 pt-8" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
      {children}
    </div>
  );
}

function StepCategory({ value, onPick }: { value: CategoryId | null; onPick: (c: CategoryId) => void }) {
  return (
    <div className="haven-rise flex flex-1 flex-col">
      <div className="grid grid-cols-2 gap-2.5">
        {EVERYDAY_CATEGORIES.map((c, i) => (
          <button
            key={c.id}
            onClick={() => onPick(c.id)}
            aria-pressed={value === c.id}
            style={{ animationDelay: `${i * 25}ms` }}
            className={`press haven-rise flex min-h-[72px] items-center gap-3 rounded-card px-3.5 py-3 text-left ${
              value === c.id ? "bg-surface-3 ring-2 ring-text" : "bg-surface hover:bg-surface-2"
            }`}
          >
            <CategoryIcon category={c.id} size="lg" animated />
            <span className="min-w-0 text-[15px] font-semibold leading-tight tracking-[-0.01em]">{c.label}</span>
          </button>
        ))}
      </div>
      <p className="mt-5 text-center text-[13px] leading-relaxed text-faint">Report only what you can see from a safe place.</p>
      <div className="mt-auto pb-6 pt-6">
        <EmergencyNote compact />
      </div>
    </div>
  );
}

function StepLocation({
  start,
  recenterKey,
  category,
  point,
  onChange,
  onUseMyLocation,
  onNext,
  hasPosition,
}: {
  start: LatLng;
  recenterKey: number;
  category: CategoryId;
  point: LatLng | null;
  onChange: (p: LatLng) => void;
  onUseMyLocation: () => void;
  onNext: () => void;
  hasPosition: boolean;
}) {
  const p = point ?? start;
  const key = `/api/geocode/reverse?lat=${p.lat.toFixed(3)}&lng=${p.lng.toFixed(3)}`;
  const { data, isLoading } = useSWR<{ label: string }>(key, fetcher, { revalidateOnFocus: false, keepPreviousData: true });

  return (
    <div className="haven-rise flex flex-1 flex-col">
      <MiniMap
        mode="picker"
        center={start}
        recenterKey={recenterKey}
        color={getCategory(category).color}
        onChange={onChange}
        className="h-[min(50dvh,440px)]"
        label="Map to choose the incident location. Drag to move the pin."
      />
      <div className="mt-4 flex items-center gap-3">
        <div className="min-w-0 flex-1">
          <p className="text-[12.5px] text-muted">Approximate location</p>
          <p className="truncate text-[17px] font-semibold tracking-[-0.015em]">{isLoading && !data ? "Finding street…" : data?.label || "Near the pin"}</p>
        </div>
        <button
          onClick={onUseMyLocation}
          aria-label={hasPosition ? "Use my location" : "Enable location"}
          className="press flex size-11 shrink-0 items-center justify-center rounded-full bg-surface-2 text-brand"
        >
          <LocateFixed className="size-5" aria-hidden />
        </button>
      </div>
      <p className="mt-2 text-[12.5px] leading-snug text-faint">Rounded to about 100 m. Your exact position is never shared.</p>
      <StickyFooter>
        <Button size="lg" block onClick={onNext}>
          Confirm location
        </Button>
      </StickyFooter>
    </div>
  );
}

function StepDetails({ category, value, onChange, onNext }: { category: CategoryId; value: string; onChange: (v: string) => void; onNext: () => void }) {
  const def = getCategory(category);
  return (
    <div className="haven-rise flex flex-1 flex-col">
      <label htmlFor="desc" className="sr-only">
        Describe what you see
      </label>
      <textarea
        id="desc"
        autoFocus
        rows={5}
        value={value}
        onChange={(e) => onChange(e.target.value.slice(0, MAX_DESCRIPTION))}
        placeholder={`${def.hint}…`}
        className="w-full resize-none rounded-card bg-surface p-4 text-[17px] leading-relaxed outline-none ring-brand/60 transition placeholder:text-faint focus:ring-2"
      />
      <p className="mt-1.5 text-right text-[12px] text-faint tnum">
        {value.length}/{MAX_DESCRIPTION}
      </p>
      <ul className="mt-3 space-y-2 text-[13.5px] leading-snug text-muted">
        <li className="flex gap-2.5">
          <Check className="mt-0.5 size-4 shrink-0 text-ok" aria-hidden /> What, where, how many vehicles or crews
        </li>
        <li className="flex gap-2.5">
          <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> Names, faces, plates, phone numbers, addresses
        </li>
        <li className="flex gap-2.5">
          <X className="mt-0.5 size-4 shrink-0 text-danger" aria-hidden /> Describing anyone by race or ethnicity
        </li>
      </ul>
      <StickyFooter>
        <Button block size="lg" onClick={onNext}>
          {value.trim() ? "Continue" : "Skip"}
        </Button>
      </StickyFooter>
    </div>
  );
}

function StepReview({
  category,
  point,
  description,
  submitting,
  onEdit,
  onSubmit,
}: {
  category: CategoryId;
  point: LatLng;
  description: string;
  submitting: boolean;
  onEdit: (s: Step) => void;
  onSubmit: () => void;
}) {
  const def = getCategory(category);
  const { data: geo } = useSWR<{ label: string }>(`/api/geocode/reverse?lat=${point.lat.toFixed(3)}&lng=${point.lng.toFixed(3)}`, fetcher, {
    revalidateOnFocus: false,
  });
  // Tell people up front when their report will join an existing one.
  const { items } = useIncidents({
    center: point,
    radiusMi: Math.max(0.15, def.dedupeRadiusM / 1609),
    categories: categoriesInGroup(def.group),
    includeResolved: false,
    limit: 5,
  });
  const similar = useMemo(() => items.find((i) => !i.isDemo), [items]);

  return (
    <div className="haven-rise flex flex-1 flex-col">
      <div className="divide-y divide-line rounded-card bg-surface px-4">
        <ReviewRow label="Category" onEdit={() => onEdit(1)}>
          <span className="flex items-center gap-2.5">
            <CategoryIcon category={category} size="sm" />
            {def.label}
          </span>
        </ReviewRow>
        <ReviewRow label="Location" onEdit={() => onEdit(2)}>
          {geo?.label || "Near the pin you placed"}
        </ReviewRow>
        <ReviewRow label="Details" onEdit={() => onEdit(3)}>
          {description.trim() ? <span className="line-clamp-4 break-words">{description.trim()}</span> : <span className="text-muted">None</span>}
        </ReviewRow>
      </div>

      {similar && (
        <div className="mt-3 flex gap-3 rounded-2xl bg-warn/[0.08] px-4 py-3.5">
          <Layers className="mt-0.5 size-[18px] shrink-0 text-warn" aria-hidden />
          <p className="text-[14px] leading-snug text-text/90">
            A similar report is already nearby. Yours will be added to it as a confirmation instead of creating a duplicate.
          </p>
        </div>
      )}

      <p className="mt-4 px-1 text-[13px] leading-relaxed text-faint">
        Reports are anonymous to other people. Personal details are removed automatically. False reports can be flagged and hidden.
      </p>

      <StickyFooter>
        <Button block size="lg" onClick={onSubmit} loading={submitting}>
          Submit report
        </Button>
      </StickyFooter>
    </div>
  );
}

function ReviewRow({ label, onEdit, children }: { label: string; onEdit: () => void; children: React.ReactNode }) {
  return (
    <div className="flex items-start gap-3 py-3.5">
      <div className="min-w-0 flex-1">
        <p className="text-[12.5px] text-muted">{label}</p>
        <div className="mt-0.5 text-[15.5px] tracking-[-0.01em]">{children}</div>
      </div>
      <button onClick={onEdit} className="-mr-2 min-h-11 rounded-full px-3 text-[14px] font-medium text-brand">
        Edit
      </button>
    </div>
  );
}

function StepDone({ result }: { result: Result }) {
  return (
    <div className="haven-rise flex flex-1 flex-col items-center justify-center text-center" style={{ paddingTop: "var(--safe-top)" }}>
      <div className="haven-pop flex size-[72px] items-center justify-center rounded-full bg-ok/15" style={{ animationDelay: "120ms" }}>
        <Check className="size-9 text-ok" strokeWidth={2.5} aria-hidden />
      </div>
      <h1 className="mt-6 text-[26px] font-bold tracking-[-0.025em]">{result.merged ? "Added to an existing report" : "Report shared"}</h1>
      <p className="mt-2 max-w-[300px] text-[15px] leading-relaxed text-muted">
        {result.merged
          ? "Someone already reported this. Yours counts as a confirmation and helps others trust it."
          : "People nearby can now see it. You can add updates or mark it as ended from the incident page."}
      </p>
      {result.redacted && <p className="mt-4 max-w-xs text-[13px] text-faint">We removed some personal details from your description.</p>}
      <div className="mt-10 w-full space-y-2" style={{ paddingBottom: "calc(var(--safe-bottom) + 16px)" }}>
        <ButtonLink href={`/incidents/${result.incidentId}`} block size="lg">
          View incident
        </ButtonLink>
        <ButtonLink href="/" variant="ghost" block size="lg">
          Back to map
        </ButtonLink>
      </div>
    </div>
  );
}
