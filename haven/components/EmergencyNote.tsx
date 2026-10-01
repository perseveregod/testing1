import { Phone } from "lucide-react";
import { EMERGENCY_NUMBER } from "@/lib/client/defaults";

/** Haven is informational. This line appears wherever someone might act. */
export function EmergencyNote({ compact }: { compact?: boolean }) {
  return (
    <div className={`flex items-center gap-3 rounded-2xl bg-danger/[0.08] ${compact ? "py-2.5 pl-4 pr-2.5" : "py-3 pl-4 pr-3"}`}>
      <p className={`flex-1 leading-snug text-text/85 ${compact ? "text-[13px]" : "text-[14px]"}`}>
        In an emergency, call {EMERGENCY_NUMBER}. Haven doesn&apos;t contact emergency services.
      </p>
      <a
        href={`tel:${EMERGENCY_NUMBER}`}
        className="press inline-flex min-h-10 shrink-0 items-center gap-1.5 rounded-full bg-danger px-3.5 text-[14px] font-semibold text-white"
      >
        <Phone className="size-4" aria-hidden /> {EMERGENCY_NUMBER}
      </a>
    </div>
  );
}
