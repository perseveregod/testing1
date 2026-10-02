// Anonymous visit counting: which page, which day, and where the visitor came
// from. No IP addresses, cookies or per-person records are kept, only totals.

const TZ = process.env.STATS_TZ || "America/Chicago";
const dayFmt = new Intl.DateTimeFormat("en-CA", { timeZone: TZ, year: "numeric", month: "2-digit", day: "2-digit" });

// The calendar day (YYYY-MM-DD) in the business's own time zone.
const dayKey = (now = new Date()) => dayFmt.format(now);

// Link previews, uptime checks, scripts and our own keep-awake ping are not visitors.
const BOT = /bot|crawl|spider|slurp|preview|externalhit|meta-external|whatsapp|monitor|uptime|pingdom|curl|wget|python|node|undici|headless|lighthouse|keepawake|go-http|okhttp|axios|scrapy|feedfetcher|render/i;
const isBot = (userAgent) => !userAgent || BOT.test(String(userAgent));

const cleanRef = (ref) => String(ref ?? "").toLowerCase().replace(/[^a-z0-9_.-]/g, "").slice(0, 40);
const bareHost = (h) => String(h ?? "").toLowerCase().replace(/:\d+$/, "").replace(/^www\./, "");

// Where a visit came from. A ?ref= tag on the link wins; otherwise the
// referring site, grouped into the few names worth comparing.
function sourceOf({ ref, referer, host } = {}) {
  const tagged = cleanRef(ref);
  if (tagged) return tagged;
  let h = "";
  try { h = bareHost(new URL(referer).hostname); } catch { /* no or bad referer */ }
  if (!h) return "direct";
  if (h === bareHost(host)) return "internal";
  if (/(^|\.)instagram\.com$/.test(h)) return "instagram";
  if (/(^|\.)(facebook\.com|fb\.com|fb\.me)$/.test(h)) return "facebook";
  if (/(^|\.)nextdoor\.com$/.test(h)) return "nextdoor";
  if (/^mail\./.test(h)) return "email";
  if (/(^|\.)google\.[a-z.]+$/.test(h)) return "google";
  if (/(^|\.)(bing\.com|duckduckgo\.com|yahoo\.com)$/.test(h)) return "search";
  return cleanRef(h);
}

// The last `n` calendar days, oldest first, ending today.
function lastDays(n, now = new Date()) {
  const out = [];
  for (let i = n - 1; i >= 0; i--) out.push(dayKey(new Date(now.getTime() - i * 86_400_000)));
  return [...new Set(out)];
}

const KINDS = ["home", "app", "demo", "signup"];

// Turns raw rows ({ day, kind, source, count }) into the two tables the owner
// page shows: one row per day, and one row per source.
function summarize(rows, days) {
  const blank = () => Object.fromEntries(KINDS.map((k) => [k, 0]));
  const byDay = new Map(days.map((d) => [d, { day: d, ...blank() }]));
  const bySource = new Map();
  for (const r of rows) {
    if (!KINDS.includes(r.kind)) continue;
    const n = Number(r.count) || 0;
    if (byDay.has(r.day)) byDay.get(r.day)[r.kind] += n;
    if (!bySource.has(r.source)) bySource.set(r.source, { source: r.source, ...blank() });
    bySource.get(r.source)[r.kind] += n;
  }
  const sources = [...bySource.values()].sort((a, b) => (b.home + b.app) - (a.home + a.app) || a.source.localeCompare(b.source));
  return { days: [...byDay.values()].reverse(), sources };
}

module.exports = { dayKey, isBot, sourceOf, cleanRef, lastDays, summarize, KINDS };
