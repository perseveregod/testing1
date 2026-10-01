// Pixel-art generation for tiles: a Claude-backed generator plus a free
// procedural fallback used when no API key is configured.

const SIZE = 16;

// PICO-8 palette. Index 0 is drawn as transparent (the canvas background).
const PALETTE = [
  "#000000", "#1d2b53", "#7e2553", "#008751",
  "#ab5236", "#5f574f", "#c2c3c7", "#fff1e8",
  "#ff004d", "#ffa300", "#ffec27", "#00e436",
  "#29adff", "#83769c", "#ff77a8", "#ffccaa",
];

const PALETTE_DESC = [
  "0 transparent/background", "1 dark navy", "2 plum", "3 dark green",
  "4 brown", "5 dark grey", "6 light grey", "7 off-white",
  "8 red", "9 orange", "a yellow", "b green",
  "c sky blue", "d lavender", "e pink", "f peach",
];

const DEFAULT_MODEL = "claude-opus-5-5";

function buildPrompt(subject) {
  return [
    `Draw "${subject}" as 16x16 pixel art, like a classic game sprite.`,
    "",
    "Palette (one hex digit per pixel):",
    PALETTE_DESC.join(", "),
    "",
    "Rules:",
    "- Use 0 for empty background so the sprite sits on the shared canvas.",
    "- Bold silhouette, 1px dark outline (1 or 0-adjacent dark colors), 3-6 colors.",
    "- Fill most of the 16x16 area; keep it instantly recognizable.",
    "",
    'Reply with only JSON: {"rows": [16 strings, each exactly 16 hex digits 0-f]}',
  ].join("\n");
}

// Turns whatever came back into exactly 256 hex digits, or null if unusable.
function normalizeRows(rows) {
  if (!Array.isArray(rows) || rows.length < 8) return null;
  const out = [];
  for (let y = 0; y < SIZE; y++) {
    const raw = String(rows[y] ?? "").toLowerCase().replace(/[^0-9a-f]/g, "");
    out.push(raw.padEnd(SIZE, "0").slice(0, SIZE));
  }
  const pixels = out.join("");
  return /[1-9a-f]/.test(pixels) ? pixels : null;
}

function extractJson(text) {
  const start = text.indexOf("{");
  const end = text.lastIndexOf("}");
  if (start === -1 || end <= start) return null;
  try {
    return JSON.parse(text.slice(start, end + 1));
  } catch {
    return null;
  }
}

class ArtError extends Error {
  constructor(code, message) {
    super(message);
    this.code = code;
  }
}

async function generateWithClaude(client, subject, model = DEFAULT_MODEL) {
  const response = await client.beta.messages.create({
    model,
    max_tokens: 16000,
    betas: ["server-side-fallback-2026-07-01"],
    fallbacks: "default",
    output_config: { effort: "low" },
    messages: [{ role: "user", content: buildPrompt(subject) }],
  });

  if (response.stop_reason === "refusal") {
    throw new ArtError("refused", "The AI won't draw that one. Try a different idea.");
  }
  const text = response.content
    .filter((b) => b.type === "text")
    .map((b) => b.text)
    .join("");
  const parsed = extractJson(text);
  const pixels = parsed && normalizeRows(parsed.rows);
  if (!pixels) throw new ArtError("bad_output", "The drawing came out garbled. Try again.");
  return pixels;
}

// Deterministic, symmetric "space invader" style sprite seeded by the prompt.
// Used in demo mode so the app works with no API key and no cost.
function generateDemo(subject) {
  let h = 2166136261;
  for (const ch of subject.toLowerCase()) {
    h ^= ch.codePointAt(0);
    h = Math.imul(h, 16777619) >>> 0;
  }
  const rand = () => {
    h ^= h << 13; h >>>= 0;
    h ^= h >>> 17;
    h ^= h << 5; h >>>= 0;
    return h / 4294967296;
  };
  const colors = [8, 9, 10, 11, 12, 14, 13, 15];
  const main = colors[Math.floor(rand() * colors.length)];
  const accent = colors[Math.floor(rand() * colors.length)];
  const grid = Array.from({ length: SIZE }, () => Array(SIZE).fill(0));
  for (let y = 2; y < 14; y++) {
    for (let x = 2; x < 8; x++) {
      const r = rand();
      if (r < 0.55) {
        const c = r < 0.12 ? accent : main;
        grid[y][x] = c;
        grid[y][SIZE - 1 - x] = c;
      }
    }
  }
  // Outline every filled pixel's empty neighbours with dark navy.
  const outlined = grid.map((row) => row.slice());
  for (let y = 0; y < SIZE; y++) {
    for (let x = 0; x < SIZE; x++) {
      if (grid[y][x] !== 0) continue;
      const near = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(
        ([dx, dy]) => grid[y + dy]?.[x + dx] > 0,
      );
      if (near) outlined[y][x] = 1;
    }
  }
  return outlined.map((row) => row.map((c) => c.toString(16)).join("")).join("");
}

module.exports = {
  SIZE,
  PALETTE,
  DEFAULT_MODEL,
  ArtError,
  buildPrompt,
  normalizeRows,
  extractJson,
  generateWithClaude,
  generateDemo,
};
