"use client";

import { useRouter } from "next/navigation";
import { Video, X } from "lucide-react";
import { setCameraAlert, useCameraAlert } from "@/lib/client/cameraAlerts";
import { useT } from "@/lib/client/lang";
import { setMapFocus } from "@/lib/client/mapFocus";
import { formatMeters } from "@/lib/cameraWatch";

/** Heads-up for a plate reader you're coming up on. Sits above every tab. */
export function CameraAlertBanner() {
  const alert = useCameraAlert();
  const { es } = useT();
  const router = useRouter();
  if (!alert) return null;
  const who = alert.camera.manufacturer ?? alert.camera.operator;
  const where = formatMeters(alert.distanceM, es);
  const title = es
    ? `Lector de placas a ${where}${alert.ahead ? " adelante" : ""}`
    : `Plate reader ${where}${alert.ahead ? " ahead" : " away"}`;
  const sub = [who, alert.othersNear > 0 ? (es ? `${alert.othersNear} más a menos de ½ mi` : `${alert.othersNear} more within ½ mi`) : null]
    .filter(Boolean)
    .join(" · ");
  return (
    <div
      role="status"
      aria-live="assertive"
      className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-3"
      style={{ top: "calc(var(--safe-top) + 10px)" }}
    >
      <div className="haven-rise pointer-events-auto flex w-full max-w-lg items-center gap-3 rounded-card bg-[#1c1530] py-2.5 pl-3.5 pr-2 text-white shadow-[inset_0_0_0_0.5px_rgba(180,140,255,0.45),0_10px_30px_-8px_rgba(0,0,0,0.7)]">
        <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-[#b48cff]/20 text-[#d6c3ff]">
          <Video className="size-[18px]" aria-hidden />
        </span>
        <button
          type="button"
          onClick={() => {
            setMapFocus({ lat: alert.camera.lat, lng: alert.camera.lng }, es ? "Lector de placas" : "Plate reader");
            router.push("/");
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block truncate text-[15px] font-semibold tracking-[-0.01em]">{title}</span>
          {sub && <span className="block truncate text-[12px] text-white/70">{sub}</span>}
        </button>
        <button
          type="button"
          onClick={() => setCameraAlert(null)}
          aria-label={es ? "Cerrar" : "Dismiss"}
          className="press flex size-9 shrink-0 items-center justify-center rounded-full text-white/60"
        >
          <X className="size-4" aria-hidden />
        </button>
      </div>
    </div>
  );
}
