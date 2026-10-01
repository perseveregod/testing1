// AI Place server: static files, a JSON API, and a Server-Sent Events stream
// that pushes new tiles to everyone watching.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { Canvas, Cooldown, cleanPrompt } = require("./lib/canvas");
const art = require("./lib/art");

const PORT = Number(process.env.PORT) || 3000;
const COOLDOWN_MS = Number(process.env.COOLDOWN_SECONDS ?? 60) * 1000;
const DATA_FILE = process.env.DATA_FILE || path.join(__dirname, "data", "canvas.json");
const MODEL = process.env.MODEL || art.DEFAULT_MODEL;
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const PUBLIC_DIR = path.join(__dirname, "public");

let client = null;
if (process.env.ANTHROPIC_API_KEY) {
  const Anthropic = require("@anthropic-ai/sdk");
  client = new (Anthropic.default || Anthropic)();
}
const demo = !client;

const canvas = new Canvas(DATA_FILE);
const cooldown = new Cooldown(COOLDOWN_MS);
const pending = new Map(); // "x,y" -> prompt, while the AI is drawing it
const watchers = new Set();

function broadcast(event, data) {
  const msg = `event: ${event}\ndata: ${JSON.stringify(data)}\n\n`;
  for (const res of watchers) res.write(msg);
}

function sendJson(res, status, body) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store" });
  res.end(JSON.stringify(body));
}

function clientIp(req) {
  if (TRUST_PROXY) {
    const fwd = req.headers["x-forwarded-for"];
    if (fwd) return String(fwd).split(",")[0].trim();
  }
  return req.socket.remoteAddress || "unknown";
}

function readBody(req, limit = 4096) {
  return new Promise((resolve, reject) => {
    let size = 0;
    const chunks = [];
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) {
        reject(new Error("too_large"));
        req.destroy();
      } else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
    req.on("error", reject);
  });
}

async function placeTile(req, res) {
  let body;
  try {
    body = JSON.parse(await readBody(req));
  } catch {
    return sendJson(res, 400, { error: "Send JSON like {x, y, prompt}." });
  }

  const x = Number(body.x);
  const y = Number(body.y);
  const prompt = cleanPrompt(body.prompt);
  if (prompt.error) return sendJson(res, 400, { error: prompt.error });
  const name = String(body.name ?? "").replace(/[^\w .-]/g, "").trim().slice(0, 20);

  const ip = clientIp(req);
  const wait = cooldown.remaining(ip);
  if (wait > 0) {
    return sendJson(res, 429, { error: `Cooling down. Try again in ${Math.ceil(wait / 1000)}s.`, retryMs: wait });
  }

  const reason = canvas.whyNot(x, y);
  if (reason) return sendJson(res, 409, { error: reason });
  const k = `${x},${y}`;
  if (pending.has(k)) return sendJson(res, 409, { error: "Someone is drawing there right now." });

  cooldown.hit(ip);
  pending.set(k, prompt.text);
  broadcast("pending", { x, y, prompt: prompt.text });

  try {
    const pixels = demo
      ? art.generateDemo(prompt.text)
      : await art.generateWithClaude(client, prompt.text, MODEL);
    const tile = canvas.place({ x, y, prompt: prompt.text, pixels, author: name || null });
    broadcast("tile", tile);
    sendJson(res, 201, { tile, cooldownMs: COOLDOWN_MS });
  } catch (err) {
    cooldown.last.delete(ip); // a failed drawing shouldn't cost a turn
    broadcast("cancel", { x, y });
    if (err instanceof art.ArtError) return sendJson(res, 422, { error: err.message });
    console.error("generation failed:", err);
    sendJson(res, 502, { error: "The AI is busy. Try again in a moment." });
  } finally {
    pending.delete(k);
  }
}

function stream(req, res) {
  res.writeHead(200, {
    "Content-Type": "text/event-stream",
    "Cache-Control": "no-store",
    Connection: "keep-alive",
  });
  res.write(`event: hello\ndata: ${JSON.stringify({ watchers: watchers.size + 1 })}\n\n`);
  watchers.add(res);
  broadcast("watchers", { count: watchers.size });
  req.on("close", () => {
    watchers.delete(res);
    broadcast("watchers", { count: watchers.size });
  });
}

const MIME = {
  ".html": "text/html; charset=utf-8",
  ".js": "text/javascript; charset=utf-8",
  ".css": "text/css; charset=utf-8",
  ".svg": "image/svg+xml",
  ".png": "image/png",
  ".ico": "image/x-icon",
};

function serveStatic(req, res, pathname) {
  const rel = pathname === "/" ? "index.html" : decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return sendJson(res, 404, { error: "Not found" });
  fs.readFile(file, (err, data) => {
    if (err) return sendJson(res, 404, { error: "Not found" });
    res.writeHead(200, { "Content-Type": MIME[path.extname(file)] || "application/octet-stream" });
    res.end(data);
  });
}

const server = http.createServer((req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  if (req.method === "GET" && pathname === "/api/tiles") {
    return sendJson(res, 200, {
      tiles: canvas.list(),
      pending: [...pending].map(([k, prompt]) => {
        const [x, y] = k.split(",").map(Number);
        return { x, y, prompt };
      }),
      palette: art.PALETTE,
      cooldownMs: COOLDOWN_MS,
      demo,
    });
  }
  if (req.method === "GET" && pathname === "/api/stream") return stream(req, res);
  if (req.method === "POST" && pathname === "/api/tiles") return placeTile(req, res);
  if (req.method === "GET") return serveStatic(req, res, pathname);
  sendJson(res, 405, { error: "Method not allowed" });
});

// Keep SSE connections alive through proxies.
setInterval(() => {
  for (const res of watchers) res.write(": ping\n\n");
}, 25000).unref();

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`AI Place running on http://localhost:${PORT}`);
    console.log(demo ? "Demo mode: no ANTHROPIC_API_KEY set, tiles use a free procedural generator." : `Drawing with ${MODEL}.`);
  });
}

module.exports = { server };
