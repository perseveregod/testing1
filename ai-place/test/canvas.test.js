const test = require("node:test");
const assert = require("node:assert");
const { Canvas, Cooldown, cleanPrompt } = require("../lib/canvas");
const art = require("../lib/art");

test("first tile must go at the origin", () => {
  const c = new Canvas(null);
  assert.ok(c.whyNot(1, 0));
  assert.strictEqual(c.whyNot(0, 0), null);
});

test("new tiles must touch existing ones, edges or corners", () => {
  const c = new Canvas(null);
  c.place({ x: 0, y: 0, prompt: "a", pixels: "1".repeat(256) });
  assert.strictEqual(c.whyNot(1, 1), null);
  assert.strictEqual(c.whyNot(-1, 0), null);
  assert.ok(c.whyNot(2, 0));
  assert.ok(c.whyNot(0, 0), "occupied");
  assert.ok(c.whyNot(0.5, 0), "non-integer");
});

test("prompts are trimmed and length-limited", () => {
  assert.deepStrictEqual(cleanPrompt("  a   frog \n"), { text: "a frog" });
  assert.ok(cleanPrompt("").error);
  assert.ok(cleanPrompt("x".repeat(61)).error);
});

test("cooldown blocks until the window passes", () => {
  const cd = new Cooldown(1000);
  assert.strictEqual(cd.remaining("ip", 0), 0);
  cd.hit("ip", 0);
  assert.strictEqual(cd.remaining("ip", 400), 600);
  assert.strictEqual(cd.remaining("ip", 1000), 0);
});

test("model output is normalized to 256 hex digits", () => {
  const rows = Array(16).fill("0123456789ABCDEF");
  assert.strictEqual(art.normalizeRows(rows).length, 256);
  const short = art.normalizeRows(Array(16).fill("11"));
  assert.strictEqual(short.length, 256);
  assert.strictEqual(art.normalizeRows(Array(16).fill("0000")), null, "blank art rejected");
  assert.strictEqual(art.normalizeRows(["1"]), null, "too few rows rejected");
});

test("JSON is extracted from chatty replies", () => {
  assert.deepStrictEqual(art.extractJson('Here you go: {"rows": ["1"]} enjoy'), { rows: ["1"] });
  assert.strictEqual(art.extractJson("no json"), null);
});

test("demo art is deterministic, symmetric, and non-empty", () => {
  const a = art.generateDemo("frog");
  assert.strictEqual(a, art.generateDemo("Frog"));
  assert.strictEqual(a.length, 256);
  assert.match(a, /^[0-9a-f]+$/);
  for (let y = 0; y < 16; y++) {
    const row = a.slice(y * 16, y * 16 + 16);
    assert.strictEqual(row, [...row].reverse().join(""));
  }
});

test("Claude refusals and garbage become friendly errors", async () => {
  const fake = (response) => ({ beta: { messages: { create: async () => response } } });
  await assert.rejects(
    art.generateWithClaude(fake({ stop_reason: "refusal", content: [] }), "x"),
    (e) => e.code === "refused",
  );
  await assert.rejects(
    art.generateWithClaude(fake({ stop_reason: "end_turn", content: [{ type: "text", text: "nope" }] }), "x"),
    (e) => e.code === "bad_output",
  );
  const good = JSON.stringify({ rows: Array(16).fill("0000111122220000") });
  const pixels = await art.generateWithClaude(fake({ stop_reason: "end_turn", content: [{ type: "text", text: good }] }), "x");
  assert.strictEqual(pixels.length, 256);
});
