// The shared canvas: an unbounded grid of tiles that grows outward.
// A new tile must touch an existing one (edge or corner), so the picture
// spreads organically from the first tile at (0, 0).

const fs = require("fs");
const path = require("path");

const MAX_COORD = 500;
const MAX_PROMPT = 60;

const key = (x, y) => `${x},${y}`;

class Canvas {
  constructor(file) {
    this.file = file;
    this.tiles = new Map();
    this.load();
  }

  load() {
    if (!this.file || !fs.existsSync(this.file)) return;
    const list = JSON.parse(fs.readFileSync(this.file, "utf8"));
    for (const t of list) this.tiles.set(key(t.x, t.y), t);
  }

  save() {
    if (!this.file) return;
    fs.mkdirSync(path.dirname(this.file), { recursive: true });
    const tmp = this.file + ".tmp";
    fs.writeFileSync(tmp, JSON.stringify([...this.tiles.values()]));
    fs.renameSync(tmp, this.file);
  }

  get(x, y) {
    return this.tiles.get(key(x, y)) || null;
  }

  list() {
    return [...this.tiles.values()];
  }

  // Returns null when (x, y) can take a new tile, else a reason string.
  whyNot(x, y) {
    if (!Number.isInteger(x) || !Number.isInteger(y)) return "Pick a tile on the canvas.";
    if (Math.abs(x) > MAX_COORD || Math.abs(y) > MAX_COORD) return "That's off the edge of the world.";
    if (this.tiles.has(key(x, y))) return "Someone already drew there. Pick an empty tile.";
    if (this.tiles.size === 0) return x === 0 && y === 0 ? null : "The first tile goes in the middle.";
    for (let dy = -1; dy <= 1; dy++) {
      for (let dx = -1; dx <= 1; dx++) {
        if ((dx || dy) && this.tiles.has(key(x + dx, y + dy))) return null;
      }
    }
    return "New tiles have to touch the existing art.";
  }

  place({ x, y, prompt, pixels, author }) {
    const tile = { x, y, prompt, pixels, author, createdAt: Date.now() };
    this.tiles.set(key(x, y), tile);
    this.save();
    return tile;
  }
}

function cleanPrompt(input) {
  const text = String(input ?? "").replace(/\s+/g, " ").trim();
  if (!text) return { error: "Describe what to draw." };
  if (text.length > MAX_PROMPT) return { error: `Keep it under ${MAX_PROMPT} characters.` };
  return { text };
}

// Fixed-window limiter: one action per `windowMs` per key (IP address).
class Cooldown {
  constructor(windowMs) {
    this.windowMs = windowMs;
    this.last = new Map();
  }

  remaining(id, now = Date.now()) {
    const t = this.last.get(id);
    return t === undefined ? 0 : Math.max(0, t + this.windowMs - now);
  }

  hit(id, now = Date.now()) {
    this.last.set(id, now);
    if (this.last.size > 50000) {
      for (const [k, t] of this.last) if (t + this.windowMs < now) this.last.delete(k);
    }
  }
}

module.exports = { Canvas, Cooldown, cleanPrompt, MAX_PROMPT };
