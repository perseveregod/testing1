"use client";

import { ExternalLink, Radio } from "lucide-react";
import { StormIcon } from "./StormIcon";
import { useState } from "react";
import { setStormPrefs, useStormPrefs } from "@/lib/client/stormMode";
import { OFFICIAL_SOURCES, strings } from "@/lib/storm";
import { EMERGENCY_NUMBER } from "@/lib/client/defaults";
import { Sheet } from "@/components/ui/Sheet";

/** The always-visible Storm Mode safety banner, with the official sources and language switch. */
export function StormBanner() {
  const { lang } = useStormPrefs();
  const t = strings(lang);
  const [sourcesOpen, setSourcesOpen] = useState(false);
  return (
    <>
      <div role="note" className="panel pointer-events-auto flex items-center gap-2 rounded-full py-1 pl-3 pr-1">
        <StormIcon className="size-5 shrink-0 text-text" active />
        <p className="min-w-0 flex-1 truncate text-[12.5px] font-semibold text-text/90">{t.bannerShort}</p>
        <button
          onClick={() => setSourcesOpen(true)}
          className="press inline-flex h-8 shrink-0 items-center gap-1 rounded-full bg-text/[0.07] px-2.5 text-[12px] font-semibold text-text"
        >
          <Radio className="size-3.5 text-[#FFC233]" aria-hidden />
          {t.officialSourcesShort}
        </button>
        <a href={`tel:${EMERGENCY_NUMBER}`} className="press inline-flex h-8 shrink-0 items-center rounded-full bg-live px-2.5 text-[12px] font-bold text-white">
          {EMERGENCY_NUMBER}
        </a>
        <button
          onClick={() => setStormPrefs({ lang: lang === "en" ? "es" : "en" })}
          aria-label={lang === "en" ? "Cambiar a español" : "Switch to English"}
          className="press inline-flex h-8 shrink-0 items-center rounded-full px-2 text-[12px] font-semibold text-muted"
        >
          {lang === "en" ? "ES" : "EN"}
        </button>
      </div>
      <OfficialSourcesSheet open={sourcesOpen} onClose={() => setSourcesOpen(false)} />
    </>
  );
}

export function OfficialSourcesSheet({ open, onClose }: { open: boolean; onClose: () => void }) {
  const { lang } = useStormPrefs();
  const t = strings(lang);
  return (
    <Sheet open={open} onClose={onClose} title={t.officialSources}>
      <p className="mb-3 text-[14px] leading-relaxed text-muted">{t.officialIntro}</p>
      <ul className="divide-y divide-line overflow-hidden rounded-[18px] bg-surface-2">
        {OFFICIAL_SOURCES.map((s) => (
          <li key={s.id}>
            <a
              href={s.url}
              target="_blank"
              rel="noopener noreferrer"
              className="flex min-h-[60px] items-center gap-3 px-4 py-3 active:bg-surface-3"
            >
              <div className="min-w-0 flex-1">
                <p className="text-[15.5px] font-semibold">{s.name}</p>
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
