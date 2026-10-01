import { timeAgo, clockTime } from "@/lib/time";
import type { PublicIncidentUpdate } from "@/lib/types";

const AUTHOR: Record<PublicIncidentUpdate["author"], string> = {
  you: "You",
  community: "Someone nearby",
  source: "Source",
  system: "Haven",
};

export function Timeline({ updates }: { updates: PublicIncidentUpdate[] }) {
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
              <span className="font-medium text-text/80">{AUTHOR[u.author]}</span>
              <span className="text-faint"> · </span>
              <time dateTime={u.createdAt} title={clockTime(u.createdAt)} className="tnum">
                {timeAgo(u.createdAt)}
              </time>
            </p>
            <p className="mt-1 break-words text-[15px] leading-[1.5]">{u.body}</p>
          </div>
        </li>
      ))}
    </ol>
  );
}
