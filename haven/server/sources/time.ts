/**
 * Converts a wall-clock timestamp ("2026-10-01T03:37:00", no offset) in the
 * given IANA zone to an ISO instant. Offsets are read from Intl, so daylight
 * saving is handled without a timezone library.
 */
export function zonedLocalToIso(local: string, timeZone: string): string {
  const asUtc = new Date(`${local.replace(/\.\d+$/, "")}Z`);
  const name =
    new Intl.DateTimeFormat("en-US", { timeZone, timeZoneName: "shortOffset" })
      .formatToParts(asUtc)
      .find((p) => p.type === "timeZoneName")?.value ?? "GMT";
  const m = name.match(/GMT([+-])(\d+)(?::(\d+))?/);
  const sign = m?.[1] === "-" ? -1 : 1;
  const offsetMin = m ? sign * (Number(m[2]) * 60 + Number(m[3] ?? 0)) : 0;
  return new Date(asUtc.getTime() - offsetMin * 60_000).toISOString();
}
