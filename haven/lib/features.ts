// Feature flags. Things that exist in the code but aren't ready for everyone:
// a board nobody has posted to yet, charts with a week of data. Flip them on
// with NEXT_PUBLIC_FEATURES="events,insights" (comma list) in the hosting env.

const ON = new Set(
  (process.env.NEXT_PUBLIC_FEATURES ?? "")
    .split(",")
    .map((s) => s.trim())
    .filter(Boolean),
);

export const FEATURES = {
  /** Community events board (tab + posting). Hidden until there are users to fill it. */
  events: ON.has("events"),
  /** Area insights charts. Hidden until real feeds have a month of history. */
  insights: ON.has("insights"),
} as const;
