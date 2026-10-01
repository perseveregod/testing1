import type { Lang } from "./i18n";

export function timeAgo(iso: string, now: number = Date.now()): string {
  return timeAgoIn("en", iso, now);
}

/** "3 min ago" / "hace 3 min". */
export function timeAgoIn(lang: Lang, iso: string, now: number = Date.now()): string {
  const es = lang === "es";
  const diff = Math.max(0, now - new Date(iso).getTime());
  const s = Math.floor(diff / 1000);
  if (s < 45) return es ? "ahora mismo" : "just now";
  const m = Math.floor(s / 60);
  if (m < 60) return es ? `hace ${Math.max(1, m)} min` : `${Math.max(1, m)} min ago`;
  const h = Math.floor(m / 60);
  if (h < 24) return es ? `hace ${h} h` : `${h} hr ago`;
  const d = Math.floor(h / 24);
  if (d < 7) return es ? `hace ${d} d` : `${d}d ago`;
  return new Date(iso).toLocaleDateString(es ? "es-US" : undefined, { month: "short", day: "numeric" });
}

export function clockTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
}

export function dateTime(iso: string): string {
  return new Date(iso).toLocaleString(undefined, {
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });
}

export const HOUR_MS = 3_600_000;
