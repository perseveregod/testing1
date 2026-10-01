import { FlaskConical } from "lucide-react";

/**
 * Shown once above any list that contains only demo incidents, so nobody
 * mistakes the examples for real events. Each row keeps its own Demo tag.
 */
export function DemoNotice({ className = "" }: { className?: string }) {
  return (
    <div
      role="note"
      className={`mt-2 flex items-center gap-3 rounded-control bg-white/[0.05] px-3.5 py-2.5 text-[13px] leading-snug text-muted ${className}`}
    >
      <FlaskConical className="size-4 shrink-0 text-faint" aria-hidden />
      <span>
        <span className="font-semibold text-text/85">Demo data.</span> These are fictional examples, not real events.
      </span>
    </div>
  );
}
