"use client";

import { clockTime } from "@/lib/time";
import { useT } from "@/lib/client/lang";
import { updateBody, type Key } from "@/lib/i18n";
import type { IncidentStatus, PublicIncidentUpdate } from "@/lib/types";

const AUTHOR: Record<PublicIncidentUpdate["author"], Key> = {
  you: "inc.who.you",
  community: "inc.who.community",
  source: "inc.who.source",
  system: "inc.who.system",
};

export function Timeline({ updates }: { updates: PublicIncidentUpdate[] }) {
  const { t, lang, timeAgo } = useT();
  // Newest first reads best on a phone.
  const items = [...updates].reverse();
  return (
    <ol>
      {items.map((u, idx) => (
        <li key={u.id} className="relative flex gap-4 pb-6 last:pb-0">
          {idx < items.length - 1 && <span className="absolute left-[5px] top-4 h-full w-px bg-line-strong" aria-hidden />}
          <span className={`relative mt-[7px] size-[11px] shrink-0 rounded-full ${idx === 0 ? "bg-brand" : "bg-surface-3 ring-1 ring-line-strong"}`} aria-hidden />
          <div className="min-w-0 flex-1">
            <p className="text-[13px] text-muted">
              <span className="font-medium text-text/80">{t(AUTHOR[u.author])}</span>
              <span className="text-faint"> · </span>
              <time dateTime={u.createdAt} className="tnum">
                {clockTime(u.createdAt)} · {timeAgo(u.createdAt)}
              </time>
            </p>
            <p className="mt-1 break-words text-[15px] leading-[1.5]">{updateBody(u.body, lang)}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}

const STEP_KEYS: Key[] = ["inc.step.reported", "inc.step.responding", "inc.step.contained", "inc.step.cleared"];
const STEP_FOR: Record<IncidentStatus, number> = { under_review: 0, active: 1, contained: 2, resolved: 3 };

/** Where the incident is in its life: Reported → Responding → Contained → Cleared. */
export function StatusStepper({ status, color }: { status: IncidentStatus; color: string }) {
  const { t, es } = useT();
  const STEPS = STEP_KEYS.map((k) => t(k));
  const current = STEP_FOR[status];
  const ended = status === "resolved";
  return (
    <div role="group" aria-label={`${t("inc.status")}: ${STEPS[current]}`}>
      <div className="flex items-center">
        {STEPS.map((label, i) => {
          const done = i <= current;
          const isCurrent = i === current && !ended;
          return (
            <div key={label} className="flex flex-1 items-center last:flex-none">
              <span className="relative flex size-3.5 shrink-0 items-center justify-center" aria-hidden>
                {isCurrent && <span className="haven-pulse absolute inset-0 rounded-full" style={{ background: color }} />}
                <span
                  className={`relative size-3.5 rounded-full ${done ? "" : "bg-surface-3 ring-1 ring-line-strong"}`}
                  style={done ? { background: ended ? "var(--ok)" : color } : undefined}
                />
              </span>
              {i < STEPS.length - 1 && (
                <span
                  className="mx-1.5 h-[3px] flex-1 rounded-full"
                  style={{ background: i < current ? (ended ? "var(--ok)" : color) : "var(--surface-3)" }}
                  aria-hidden
                />
              )}
            </div>
          );
        })}
      </div>
      <div className={`relative mt-2 h-4 font-semibold ${es ? "text-[11px]" : "text-[12px]"}`}>
        {STEPS.map((label, i) => {
          const pct = (i / (STEPS.length - 1)) * 100;
          const shift = i === 0 ? "0%" : i === STEPS.length - 1 ? "-100%" : "-50%";
          return (
            <span
              key={label}
              className={`absolute top-0 whitespace-nowrap ${i === current ? "text-text" : i < current ? "text-muted" : "text-faint"}`}
              style={{ left: `${pct}%`, transform: `translateX(${shift})` }}
              aria-current={i === current ? "step" : undefined}
            >
              {label}
            </span>
          );
        })}
      </div>
    </div>
  );
}
