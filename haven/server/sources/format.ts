/** "phinney ave n" → "Phinney Ave N"; compass points stay upper-case. */
export function titleCase(s: string): string {
  return s
    .toLowerCase()
    .replace(/\b([a-z])/g, (c) => c.toUpperCase())
    .replace(/\b(Ne|Nw|Se|Sw|N|S|E|W|Ib|Ob|Fwy|Us|Ih|Sh|Fm)\b/g, (x) => x.toUpperCase())
    .replace(/\bFWY\b/g, "Fwy")
    .replace(/\bIB\b/g, "inbound")
    .replace(/\bOB\b/g, "outbound");
}

/** "6561 Phinney Ave N" → "6500 block of Phinney Ave N". Addresses without a number are only tidied. */
export function toBlock(address: string): string {
  const m = address.trim().match(/^(\d+)\s+(.+)$/);
  if (!m) return titleCase(address.replace(/\s+/g, " ").trim());
  const block = Math.floor(Number(m[1]) / 100) * 100;
  return `${block} block of ${titleCase(m[2]!)}`;
}
