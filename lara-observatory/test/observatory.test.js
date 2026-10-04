// Run with: node --test lara-observatory/test/observatory.test.js
const test = require('node:test');
const assert = require('node:assert');
const LM = require('../math.js');
const api = require('../api/market.js');

const series = (n, f, t0 = 0) => Array.from({ length: n }, (_, i) => ({ t: t0 + i * 300, c: 100 + f(i) }));

test('a gap between bars never becomes a 5-minute return', () => {
  const bars = [{ t: 0, c: 100 }, { t: 300, c: 101 }, { t: 4200, c: 110 }, { t: 4500, c: 111 }];
  assert.strictEqual(LM.returnsOf(bars).length, 2);
});

test('correlation is 1 for identical series and unmeasured without enough shared bars', () => {
  const a = LM.returnsOf(series(200, i => Math.sin(i) * 2 + Math.cos(i * 0.3)));
  assert.ok(Math.abs(LM.pairCorr(a, a).r - 1) < 1e-9);
  const late = LM.returnsOf(series(200, i => Math.sin(i), 200 * 300));
  assert.strictEqual(LM.pairCorr(a, late).r, null);
});

test('the 3D map reproduces distances it can represent exactly', () => {
  const pts = [[0, 0, 0], [1, 0, 0], [0, 2, 0], [0, 0, 3], [1, 1, 1]];
  const D = pts.map(p => pts.map(q => Math.hypot(p[0] - q[0], p[1] - q[1], p[2] - q[2])));
  const P = LM.mds3(D);
  for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++)
    assert.ok(Math.abs(Math.hypot(P[i][0] - P[j][0], P[i][1] - P[j][1], P[i][2] - P[j][2]) - D[i][j]) < 1e-9);
});

test('each density ridge is a proper distribution', () => {
  const rets = LM.returnsOf(series(300, i => Math.sin(i * 1.7) + Math.sin(i * 0.31) * 2));
  const S = LM.densitySurface(rets);
  const dx = S.xs[1] - S.xs[0];
  for (const s of S.slices) { const area = s.dens.reduce((q, d) => q + d, 0) * dx; assert.ok(area > 0.9 && area < 1.01); }
});

test('the API keeps only finished, on-grid, priced bars', () => {
  const now = 10000;
  const j = { chart: { result: [{ timestamp: [8400, 8700, 9000, 9123, 9300, 9900], indicators: { quote: [{ close: [1, null, 3, 4, 5, 6] }] } }] } };
  assert.deepStrictEqual(api.parseYahoo(j, now), [[8400, 1], [9000, 3], [9300, 5]]); // 8700 null, 9123 off-grid, 9900 still forming
  assert.strictEqual(api.parseYahoo({ chart: { result: null } }, now), null);
});
