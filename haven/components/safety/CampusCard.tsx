"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BellPlus, Check, ChevronRight, Footprints, GraduationCap, MapPinned, Phone, ShieldAlert } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { setCampusId, useCampusId } from "@/lib/client/campus";
import { setMapFocus } from "@/lib/client/mapFocus";
import { useIncidents, usePlaces } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { CAMPUSES, getCampus, telHref, type Campus } from "@/lib/campuses";
import { useToast } from "@/components/providers/ToastProvider";
import { Sheet } from "@/components/ui/Sheet";

/** Safety tab card for students: campus police, escort, nearby incidents, campus alerts. */
export function CampusCard() {
  const campusId = useCampusId();
  const campus = getCampus(campusId);
  const [picking, setPicking] = useState(false);
  const { es } = useT();

  return (
    <>
      {campus ? (
        <CampusDetails campus={campus} onChange={() => setPicking(true)} />
      ) : (
        <button
          onClick={() => setPicking(true)}
          className="press flex w-full items-center gap-3.5 rounded-card bg-surface p-4 text-left"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-brand/15 text-brand">
            <GraduationCap className="size-6" aria-hidden />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block text-[16px] font-bold tracking-[-0.01em]">{es ? "¿Estudiante? Agregue su campus" : "Student? Add your campus"}</span>
            <span className="mt-0.5 block text-[13px] leading-snug text-muted">
              {es ? "Policía del campus, acompañantes de seguridad y qué pasa alrededor del campus." : "Campus police, safety escorts and what's happening around campus."}
            </span>
          </span>
          <ChevronRight className="size-5 shrink-0 text-faint" aria-hidden />
        </button>
      )}
      <CampusPicker open={picking} onClose={() => setPicking(false)} current={campusId} />
    </>
  );
}

function CampusDetails({ campus, onChange }: { campus: Campus; onChange: () => void }) {
  const toast = useToast();
  const router = useRouter();
  const center = { lat: campus.lat, lng: campus.lng };
  const { items, isLoading } = useIncidents({ center, radiusMi: 1, sort: "newest", limit: 50 });
  const { places, max, mutate } = usePlaces();
  const [busy, setBusy] = useState(false);
  const { es, title } = useT();
  const active = items.filter((i) => i.status !== "resolved");
  const saved = places.some((p) => p.kind === "school" && Math.abs(p.latitude - campus.lat) < 0.002 && Math.abs(p.longitude - campus.lng) < 0.002);

  async function addAlerts() {
    setBusy(true);
    try {
      await apiSend("/api/places", "POST", {
        kind: "school",
        label: campus.name.slice(0, 40),
        latitude: campus.lat,
        longitude: campus.lng,
        address: campus.school,
        alertsEnabled: true,
      });
      await mutate();
      toast(es ? `Recibirá alertas alrededor de ${campus.name}.` : `You'll get alerts around ${campus.name}.`, "success");
    } catch (err) {
      toast(
        places.length >= max
          ? es
            ? "Su lugar guardado gratis ya está en uso. Quítelo en Perfil o mejore su plan para guardar más."
            : "Your free saved place is already used. Remove it in Profile, or upgrade to save more."
          : errorMessage(err),
        "error",
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="rounded-card bg-surface p-4">
      <div className="flex items-start gap-3">
        <span className="flex size-11 shrink-0 items-center justify-center rounded-card bg-brand/15 text-brand">
          <GraduationCap className="size-6" aria-hidden />
        </span>
        <div className="min-w-0 flex-1">
          <p className="text-[12px] font-semibold text-faint">{es ? "Su campus" : "Your campus"}</p>
          <p className="line-clamp-2 text-[17px] font-bold leading-tight tracking-[-0.015em]">{campus.name}</p>
          <p className="text-[13px] text-muted tnum">
            {isLoading
              ? es
                ? "Revisando los alrededores…"
                : "Checking nearby…"
              : es
                ? `${active.length} ${active.length === 1 ? "incidente" : "incidentes"} a menos de 1 mi hoy`
                : `${active.length} ${active.length === 1 ? "incident" : "incidents"} within 1 mi today`}
          </p>
        </div>
        <button onClick={onChange} className="press -mr-1 min-h-11 rounded-full px-3 text-[13px] font-semibold text-brand">
          {es ? "Cambiar" : "Change"}
        </button>
      </div>

      {active.length > 0 && (
        <ul className="mt-3 space-y-1.5">
          {active.slice(0, 2).map((i) => (
            <li key={i.id}>
              <Link href={`/incidents/${i.id}`} transitionTypes={["nav-forward"]} className="flex min-h-11 items-center gap-2 rounded-control bg-surface-2 px-3 py-2 text-[13px]">
                <span className="truncate font-semibold">{title(i)}</span>
                <span className="truncate text-muted">· {i.approximateAddress}</span>
              </Link>
            </li>
          ))}
        </ul>
      )}

      <div className="mt-3 grid grid-cols-2 gap-2">
        <a
          href={telHref(campus.police.emergency)}
          className="press flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-card bg-live px-3 text-[14px] font-bold text-white"
        >
          <ShieldAlert className="size-4 shrink-0" aria-hidden /> {es ? "Policía" : "Police"}
        </a>
        <a
          href={telHref(campus.police.nonEmergency)}
          className="press flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-card bg-surface-2 px-3 text-[14px] font-semibold"
        >
          <Phone className="size-4" aria-hidden /> {es ? "No emergencia" : "Non-emergency"}
        </a>
        {campus.escort ? (
          <a
            href={telHref(campus.escort.phone)}
            className="press flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-card bg-surface-2 px-3 text-[14px] font-semibold"
          >
            <Footprints className="size-4" aria-hidden /> {es ? "Acompañante" : "Safety escort"}
          </a>
        ) : (
          <Link
            href="/safety/walk"
            transitionTypes={["nav-forward"]}
            className="press flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-card bg-surface-2 px-3 text-[14px] font-semibold"
          >
            <Footprints className="size-4" aria-hidden /> {es ? "Camino seguro" : "Safe Walk"}
          </Link>
        )}
        <button
          onClick={() => {
            setMapFocus(center, campus.name);
            router.push("/", { transitionTypes: ["tab"] });
          }}
          className="press flex min-h-12 items-center justify-center gap-2 whitespace-nowrap rounded-card bg-surface-2 px-3 text-[14px] font-semibold"
        >
          <MapPinned className="size-4" aria-hidden /> {es ? "En el mapa" : "On the map"}
        </button>
      </div>

      <button
        onClick={addAlerts}
        disabled={busy || saved}
        className="press mt-2 flex min-h-12 w-full items-center justify-center gap-2 rounded-card bg-brand/15 px-3 text-[14px] font-semibold text-brand disabled:opacity-80"
      >
        {saved ? <Check className="size-4" aria-hidden /> : <BellPlus className="size-4" aria-hidden />}
        {saved ? (es ? "Recibiendo alertas del campus" : "Getting alerts around campus") : es ? "Recibir alertas del campus" : "Get alerts around campus"}
      </button>

      <p className="mt-3 text-[12px] leading-snug text-faint">
        {campus.escort ? `${campus.escort.note} ` : ""}
        {es ? "Números de " : "Numbers from "}
        <a href={campus.police.url} target="_blank" rel="noopener noreferrer" className="underline">
          {campus.police.name}
        </a>
        {es ? ". En una emergencia, llame al 911." : ". In an emergency, call 911."}
      </p>
    </div>
  );
}

function CampusPicker({ open, onClose, current }: { open: boolean; onClose: () => void; current: string | null }) {
  const schools = [...new Set(CAMPUSES.map((c) => c.school))];
  const { es } = useT();
  return (
    <Sheet open={open} onClose={onClose} title={es ? "Su campus" : "Your campus"}>
      <p className="mb-3 text-[13px] leading-snug text-muted">{es ? "Se guarda solo en este dispositivo. Puede cambiarlo cuando quiera." : "Saved on this device only. You can change it any time."}</p>
      <div className="space-y-4 pb-2">
        {schools.map((school) => (
          <div key={school}>
            <p className="mb-1.5 px-1 text-[12px] font-semibold text-faint">{school}</p>
            <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface-2">
              {CAMPUSES.filter((c) => c.school === school).map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => {
                      setCampusId(c.id);
                      onClose();
                    }}
                    aria-pressed={current === c.id}
                    className="flex min-h-[52px] w-full items-center gap-3 px-4 py-3 text-left active:bg-surface-3"
                  >
                    <span className="flex-1 text-[15px] font-medium">{c.name}</span>
                    {current === c.id && <Check className="size-5 text-brand" aria-hidden />}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
        {current && (
          <button
            onClick={() => {
              setCampusId(null);
              onClose();
            }}
            className="press min-h-11 w-full rounded-full text-[14px] font-medium text-muted"
          >
            {es ? "Quitar mi campus" : "Remove my campus"}
          </button>
        )}
        <p className="px-1 text-[12px] text-faint">{es ? "¿No ve su escuela? Pronto habrá más campus de Houston." : "Don't see your school? More Houston campuses are coming."}</p>
      </div>
    </Sheet>
  );
}
