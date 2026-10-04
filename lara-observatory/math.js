// LARA observatory math: pure functions, shared by the snapshot page and the live site.
const LM = (() => {
  const STEP = 300; // seconds in one bar

  // {b: first close (scaled int), d: "delta,delta,...", scale} -> [{t, c}]
  function decode(m, t0) {
    const out = [{ t: t0, c: m.b / m.scale }];
    let v = m.b;
    const d = m.d.split(',');
    for (let i = 0; i < d.length; i++) {
      v += Number(d[i]);
      out.push({ t: t0 + (i + 1) * STEP, c: v / m.scale });
    }
    return out;
  }

  // Percent returns between bars exactly one step apart. A gap (daily break,
  // weekend, missing bar) produces no return, so it never counts as a 5-minute move.
  function returnsOf(bars) {
    const out = [];
    for (let i = 1; i < bars.length; i++) {
      const a = bars[i - 1], b = bars[i];
      if (b.t - a.t !== STEP || !(a.c > 0) || !(b.c > 0)) continue;
      out.push({ t: b.t, r: (b.c / a.c - 1) * 100 });
    }
    return out;
  }

  function stats(v) {
    const n = v.length;
    if (!n) return { n: 0, mean: 0, sd: 0, min: 0, max: 0 };
    let s = 0, mn = Infinity, mx = -Infinity;
    for (const x of v) { s += x; if (x < mn) mn = x; if (x > mx) mx = x; }
    const mean = s / n;
    let q = 0;
    for (const x of v) q += (x - mean) * (x - mean);
    return { n, mean, sd: Math.sqrt(q / n), min: mn, max: mx };
  }

  // Pearson correlation over the last `n` return timestamps both series share.
  // r is null when fewer than `minShared` are shared or either side is flat.
  function pairCorr(ra, rb, n = 120, minShared = 30) {
    const mb = new Map();
    for (const x of rb) mb.set(x.t, x.r);
    const xa = [], xb = [];
    let asOf = null;
    for (let i = ra.length - 1; i >= 0 && xa.length < n; i--) {
      const y = mb.get(ra[i].t);
      if (y === undefined) continue;
      if (asOf === null) asOf = ra[i].t;
      xa.push(ra[i].r); xb.push(y);
    }
    const k = xa.length;
    if (k < minShared) return { r: null, n: k, asOf };
    const sa = stats(xa), sb = stats(xb);
    if (!(sa.sd > 0) || !(sb.sd > 0)) return { r: null, n: k, asOf };
    let c = 0;
    for (let i = 0; i < k; i++) c += (xa[i] - sa.mean) * (xb[i] - sb.mean);
    return { r: Math.max(-1, Math.min(1, c / k / (sa.sd * sb.sd))), n: k, asOf };
  }

  function corrMatrix(rets, n = 120, minShared = 30) {
    const m = rets.length;
    const C = Array.from({ length: m }, () => new Array(m).fill(null));
    for (let i = 0; i < m; i++) {
      C[i][i] = { r: 1, n: Math.min(n, rets[i].length), asOf: rets[i].length ? rets[i][rets[i].length - 1].t : null };
      for (let j = i + 1; j < m; j++) C[i][j] = C[j][i] = pairCorr(rets[i], rets[j], n, minShared);
    }
    return C;
  }

  // Jacobi eigen-decomposition of a small symmetric matrix.
  function jacobiEigen(A) {
    const n = A.length;
    const a = A.map(r => r.slice());
    const v = Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => (i === j ? 1 : 0)));
    for (let sweep = 0; sweep < 80; sweep++) {
      let off = 0;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) off += a[i][j] * a[i][j];
      if (off < 1e-20) break;
      for (let p = 0; p < n; p++) for (let q = p + 1; q < n; q++) {
        if (Math.abs(a[p][q]) < 1e-15) continue;
        const theta = (a[q][q] - a[p][p]) / (2 * a[p][q]);
        const t = (theta >= 0 ? 1 : -1) / (Math.abs(theta) + Math.sqrt(theta * theta + 1));
        const c = 1 / Math.sqrt(t * t + 1), s = t * c;
        for (let k = 0; k < n; k++) { const x = a[k][p], y = a[k][q]; a[k][p] = c * x - s * y; a[k][q] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = a[p][k], y = a[q][k]; a[p][k] = c * x - s * y; a[q][k] = s * x + c * y; }
        for (let k = 0; k < n; k++) { const x = v[k][p], y = v[k][q]; v[k][p] = c * x - s * y; v[k][q] = s * x + c * y; }
      }
    }
    return { values: a.map((r, i) => r[i]), vectors: v };
  }

  // Classical MDS into 3 dimensions from a distance matrix.
  function mds3(D) {
    const n = D.length;
    const sq = D.map(r => r.map(x => x * x));
    const rm = sq.map(r => r.reduce((s, x) => s + x, 0) / n);
    const gm = rm.reduce((s, x) => s + x, 0) / n;
    const B = sq.map((r, i) => r.map((x, j) => -0.5 * (x - rm[i] - rm[j] + gm)));
    const { values, vectors } = jacobiEigen(B);
    const order = values.map((_, i) => i).sort((x, y) => values[y] - values[x]).slice(0, 3);
    const coords = Array.from({ length: n }, () => [0, 0, 0]);
    order.forEach((e, k) => {
      const lam = Math.sqrt(Math.max(values[e], 0));
      let big = 0;
      for (let i = 0; i < n; i++) if (Math.abs(vectors[i][e]) > Math.abs(big)) big = vectors[i][e];
      const sign = big < 0 ? -1 : 1; // fixed sign so the map does not flip between updates
      for (let i = 0; i < n; i++) coords[i][k] = sign * vectors[i][e] * lam;
    });
    return coords;
  }

  // Map layout: correlation distance sqrt(2(1-r)), unmeasured pairs treated as r = 0.
  function layout(C, minSep = 0.34, maxR = 1.2, rmsTarget = 0.72) {
    const n = C.length;
    const D = C.map((row, i) => row.map((c, j) => (i === j ? 0 : Math.sqrt(2 * (1 - (c && c.r !== null ? c.r : 0))))));
    const P = mds3(D);
    // scale to a steady overall size (RMS radius rmsTarget), then pull far outliers in to maxR
    let ss = 0;
    for (const p of P) ss += p[0] * p[0] + p[1] * p[1] + p[2] * p[2];
    const rms = Math.sqrt(ss / n);
    const k = rms > 1e-9 ? rmsTarget / rms : 1;
    for (const p of P) {
      p[0] *= k; p[1] *= k; p[2] *= k;
      const r = Math.hypot(p[0], p[1], p[2]);
      if (r > maxR) { const f = maxR / r; p[0] *= f; p[1] *= f; p[2] *= f; }
    }
    // nudge near-identical markets apart so both stay readable
    for (let it = 0; it < 60; it++) {
      let moved = false;
      for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) {
        let dx = P[j][0] - P[i][0], dy = P[j][1] - P[i][1], dz = P[j][2] - P[i][2];
        let d = Math.hypot(dx, dy, dz);
        if (d >= minSep) continue;
        if (d < 1e-6) { dx = 0.01 * (i + 1); dy = 0.01 * (j + 1); dz = 0.01; d = Math.hypot(dx, dy, dz); }
        const push = (minSep - d) / 2 / d;
        P[i][0] -= dx * push; P[i][1] -= dy * push; P[i][2] -= dz * push;
        P[j][0] += dx * push; P[j][1] += dy * push; P[j][2] += dz * push;
        moved = true;
      }
      if (!moved) break;
    }
    return P;
  }

  function quantile(sorted, q) {
    if (!sorted.length) return 0;
    const pos = (sorted.length - 1) * q, lo = Math.floor(pos), hi = Math.ceil(pos);
    return sorted[lo] + (sorted[hi] - sorted[lo]) * (pos - lo);
  }

  // Silverman's rule of thumb: 1.06 * min(sd, IQR/1.34) * n^(-1/5), with a floor.
  function bandwidth(v, floor) {
    const s = stats(v);
    const sorted = v.slice().sort((a, b) => a - b);
    const iqr = quantile(sorted, 0.75) - quantile(sorted, 0.25);
    let spread = s.sd;
    if (iqr > 0) spread = Math.min(spread, iqr / 1.34);
    return Math.max(1.06 * spread * Math.pow(v.length, -0.2), floor);
  }

  function niceStep(x) {
    const p = Math.pow(10, Math.floor(Math.log10(x)));
    const f = x / p;
    return (f < 1.5 ? 1 : f < 3.5 ? 2 : f < 7.5 ? 5 : 10) * p;
  }

  // Ridges of return density through time. Each ridge is a Gaussian kernel
  // density of `win` consecutive returns; ridges step forward by `step` returns.
  function densitySurface(rets, opt = {}) {
    const win = opt.win || 48, step = opt.step || 5, gridN = opt.gridN || 73;
    const vals = rets.map(x => x.r);
    const all = stats(vals);
    const xmax = Math.max(4.5 * all.sd, 1e-6);
    const xs = Array.from({ length: gridN }, (_, i) => -xmax + (2 * xmax * i) / (gridN - 1));
    const ends = [];
    for (let e = vals.length; e - win >= 0; e -= step) ends.push(e);
    ends.reverse();
    const floor = 0.15 * all.sd;
    let peak = 0;
    const slices = ends.map(e => {
      const w = vals.slice(e - win, e);
      const h = bandwidth(w, floor);
      const norm = 1 / (w.length * h * Math.sqrt(2 * Math.PI));
      const dens = xs.map(x => {
        let s = 0;
        for (const y of w) { const z = (x - y) / h; s += Math.exp(-0.5 * z * z); }
        return s * norm;
      });
      for (const d of dens) if (d > peak) peak = d;
      return { tStart: rets[e - win].t, tEnd: rets[e - 1].t, h, dens };
    });
    return { xs, xmax, slices, peak, sd: all.sd, win, step, tick: niceStep(xmax / 2.2) };
  }

  return { STEP, decode, returnsOf, stats, pairCorr, corrMatrix, jacobiEigen, mds3, layout, quantile, bandwidth, niceStep, densitySurface };
})();
if (typeof module !== 'undefined') module.exports = LM;
