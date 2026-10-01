"use client";

import { Compass, ExternalLink, Video } from "lucide-react";
import { useT } from "@/lib/client/lang";
import { Sheet } from "@/components/ui/Sheet";

export interface PickedCamera {
  operator: string | null;
  manufacturer: string | null;
  direction: number | null;
  note: string | null;
  lat: number;
  lng: number;
}

function compass(deg: number): string {
  const names = ["N", "NE", "E", "SE", "S", "SW", "W", "NW"];
  return names[Math.round(deg / 45) % 8]!;
}

/** What a tapped license plate reader is, as far as the map data knows. */
export function CameraSheet({ camera, onClose }: { camera: PickedCamera | null; onClose: () => void }) {
  const { es } = useT();
  return (
    <Sheet open={camera != null} onClose={onClose} title={es ? "Lector de placas" : "License plate reader"}>
      {camera && (
        <div className="pb-2">
          <div className="flex items-start gap-3.5 rounded-[18px] bg-surface-2 p-4">
            <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#b48cff]/15 text-[#b48cff]">
              <Video className="size-6" aria-hidden />
            </span>
            <div className="min-w-0 flex-1">
              <p className="text-[16px] font-bold tracking-[-0.01em]">{camera.manufacturer ?? (es ? "Cámara ALPR" : "ALPR camera")}</p>
              <p className="mt-0.5 text-[13.5px] leading-snug text-muted">
                {camera.operator ? (es ? `Operada por ${camera.operator}` : `Operated by ${camera.operator}`) : es ? "Operador no registrado" : "Operator not recorded"}
                {camera.direction != null && (
                  <span className="inline-flex items-center gap-1">
                    {" · "}
                    <Compass className="size-3.5" aria-hidden /> {es ? "mira al" : "faces"} {compass(camera.direction)}
                  </span>
                )}
              </p>
              {camera.note && <p className="mt-1.5 text-[13.5px] leading-snug text-text/85">{camera.note}</p>}
            </div>
          </div>
          <p className="mt-3 text-[14px] leading-relaxed text-muted">
            {es
              ? "Los lectores automáticos de placas fotografían cada placa que pasa y guardan el registro, normalmente por 30 días, consultable por la policía y a veces por otras agencias. Saber dónde están es información pública."
              : "Automated license plate readers photograph every passing plate and keep the record, usually for 30 days, searchable by police and sometimes by other agencies. Knowing where they are is public information."}
          </p>
          <p className="mt-3 text-[12.5px] leading-snug text-faint">
            {es ? "Ubicación © colaboradores de OpenStreetMap, mapeada por voluntarios a través de " : "Location © OpenStreetMap contributors, mapped by volunteers through "}
            <a href="https://deflock.me" target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1 underline">
              DeFlock <ExternalLink className="size-3" aria-hidden />
            </a>
            {es ? ". Haven no las verifica; una cámara puede faltar o haberse movido." : ". Haven doesn't verify these; a camera may be missing or moved."}
          </p>
        </div>
      )}
    </Sheet>
  );
}
