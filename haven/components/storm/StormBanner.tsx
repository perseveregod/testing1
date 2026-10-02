"use client";

import { ExternalLink } from "lucide-react";
import { useStormPrefs } from "@/lib/client/stormMode";
import { OFFICIAL_SOURCES, strings } from "@/lib/storm";
import { Sheet } from "@/components/ui/Sheet";

export function OfficialSourcesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useStormPrefs();
  const t = strings(lang);
  return (
    <Sheet open={open} onClose={onClose} title={t.officialSources}>
      <p className="mb-3 text-[14px] leading-relaxed text-muted">{t.officialIntro}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface-2">
        {OFFICIAL_SOURCES.map((s) => (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[60px] items-center gap-3 px-4 py-3 active:bg-surface-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15px] font-semibold">{s.name}</p>
                <p className="mt-0.5 text-[13px] leading-snug text-muted">{t[s.desc]}</p>
              </div>
              <ExternalLink className="size-4 shrink-0 text-faint" aria-hidden />
            </a>
          </li>
        ))}
      </ul>
      <div className="h-3" />
    </Sheet>
  );
}
