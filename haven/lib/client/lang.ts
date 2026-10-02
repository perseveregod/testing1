"use client";

// The app's language, remembered on this device. Defaults to Spanish for a
// Spanish-language phone. Read with useSyncExternalStore so every screen
// switches at once; the server always renders English and the client takes
// over on hydration.

import { useCallback, useEffect, useMemo, useSyncExternalStore } from "react";
import { getCategory, type CategoryDef } from "@/lib/categories";
import { isLang, t as translate, TITLES_ES, type Key, type Lang } from "@/lib/i18n";
import { stormTitle } from "@/lib/storm";
import { timeAgoIn } from "@/lib/time";
import type { CategoryId, PublicIncident } from "@/lib/types";

const KEY = "haven.lang.v1";
// Storm Mode kept its own language before this store existed; honor it once.
const LEGACY_STORM_KEY = "haven.storm.v1";

let cached: Lang | null = null;
const listeners = new Set<() => void>();

function detect(): Lang {
  try {
    const legacy = localStorage.getItem(LEGACY_STORM_KEY);
    if (legacy) {
      const v = JSON.parse(legacy) as { lang?: unknown };
      if (isLang(v.lang)) return v.lang;
    }
  } catch {
    // Fall through to the phone's language.
  }
  return typeof navigator !== "undefined" && /^es\b/i.test(navigator.language || "") ? "es" : "en";
}

function read(): Lang {
  if (cached) return cached;
  try {
    const v = localStorage.getItem(KEY);
    cached = isLang(v) ? v : detect();
  } catch {
    cached = detect();
  }
  return cached;
}

function subscribe(cb: () => void) {
  listeners.add(cb);
  return () => listeners.delete(cb);
}

export function useLang(): Lang {
  return useSyncExternalStore(subscribe, read, () => "en");
}

export function setLang(lang: Lang) {
  cached = lang;
  try {
    localStorage.setItem(KEY, lang);
  } catch {
    // Storage blocked: lasts for this visit.
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((l) => l());
}

/** Keeps `<html lang>` in step with the chosen language. Mount once. */
export function LangSync() {
  const lang = useLang();
  useEffect(() => {
    document.documentElement.lang = lang;
  }, [lang]);
  return null;
}

export interface Translator {
  lang: Lang;
  es: boolean;
  /** A word from the dictionary, with `{slots}` filled. */
  t: (key: Key, vars?: Record<string, string | number>) => string;
  /** "3 min ago" / "hace 3 min". */
  timeAgo: (iso: string, now?: number) => string;
  /** Category label / short name / hint in the chosen language. */
  cat: (id: CategoryId) => { label: string; short: string; hint: string; def: CategoryDef };
  /** An incident's title: Haven's own titles are translated, people's words are kept. */
  title: (i: Pick<PublicIncident, "title" | "category" | "storm">) => string;
}

export function useT(): Translator {
  const lang = useLang();
  const t = useCallback((key: Key, vars?: Record<string, string | number>) => translate(lang, key, vars), [lang]);
  return useMemo(
    () => ({
      lang,
      es: lang === "es",
      t,
      timeAgo: (iso: string, now?: number) => timeAgoIn(lang, iso, now),
      cat: (id: CategoryId) => {
        const def = getCategory(id);
        return lang === "es"
          ? { label: def.labelEs, short: def.shortEs, hint: def.hintEs, def }
          : { label: def.label, short: def.short, hint: def.hint, def };
      },
      title: (i) => incidentTitle(i, lang),
    }),
    [lang, t],
  );
}

const KNOWN_SOURCES = new Set(["user", "demo", "houston_active", "nws_alerts"]);

/** A data source's name and credit line in the reader's language. */
export function sourceText(s: { id: string; name: string; attribution: string }, lang: Lang): { name: string; attribution: string } {
  if (!KNOWN_SOURCES.has(s.id)) return { name: s.name, attribution: s.attribution };
  return { name: translate(lang, `src.${s.id}.name` as Key), attribution: translate(lang, `src.${s.id}.attr` as Key) };
}

export function incidentTitle(i: Pick<PublicIncident, "title" | "category" | "storm">, lang: Lang): string {
  if (i.storm) return stormTitle(i.storm, lang);
  if (lang !== "es") return i.title;
  const def = getCategory(i.category);
  if (i.title === def.label) return def.labelEs;
  return TITLES_ES[i.title] ?? i.title;
}
