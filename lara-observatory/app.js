// LARA Market Observatory: page logic. Reads window.LARA_CONFIG:
//   { mode: 'live', api: '/api/market', every: 60 }   bars fetched from the server every minute
//   { mode: 'snapshot', snap: {...} }                  bars embedded in the page (no network)
(function () {
  'use strict';
  const CFG = window.LARA_CONFIG || { mode: 'live', api: '/api/market', every: 60 };
  const LIVE = CFG.mode === 'live';
  const TZ = 'America/Chicago';
  const UP = [0.353, 0.663, 1.0], DOWN = [1.0, 0.604, 0.239];
  const N_CORR = 120, MIN_SHARED = 30, LINK_MIN = 0.35, VIEW_BARS = 276;
  const $ = id => document.getElementById(id);

  // ---------- formatting ----------
  const tf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const df = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', month: 'short', day: 'numeric' });
  const hf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, hour: '2-digit', minute: '2-digit', hourCycle: 'h23' });
  const fmtTime = t => tf.format(new Date(t * 1000)).replace(',', '');
  const fmtDay = t => df.format(new Date(t * 1000)).replace(',', '');
  const fmtClock = t => hf.format(new Date(t * 1000));
  const signed = (x, d) => { const a = Math.abs(x).toFixed(d); return Number(a) === 0 ? a : (x > 0 ? '+' : '−') + a; };
  const fmtPrice = (c, dec) => c.toLocaleString('en-US', { minimumFractionDigits: dec, maximumFractionDigits: dec });
  const cls = x => (x > 0 ? 'up' : x < 0 ? 'down' : '');
  const ago = s => (s < 90 ? Math.max(0, Math.round(s)) + ' s' : s < 5400 ? Math.round(s / 60) + ' min' : Math.round(s / 3600) + ' h');

  // ---------- model ----------
  let markets = [], C = [], P = [], SD_MED = 1e-6, sel = 0, surface = null;
  let dataKey = '', tabKey = '', lastOk = 0, loadErr = false, field = null, dens = null, glFailed = false;
  let paused = window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  // list: [{id, name, kind, src, dec, bars: [{t, c}]}]. Returns true when anything changed.
  function ingest(list) {
    const key = list.map(m => m.id + ':' + m.bars.length + ':' + (m.bars.length ? m.bars[m.bars.length - 1].t : 0)).join('|');
    if (key === dataKey) return false;
    dataKey = key;
    const keep = markets[sel] && markets[sel].id;
    markets = list.map(m => {
      const rets = LM.returnsOf(m.bars), recent = rets.slice(-N_CORR);
      return Object.assign({}, m, { rets, recent, dens: rets.slice(-(VIEW_BARS - 1)), view: m.bars.slice(-VIEW_BARS), st: LM.stats(recent.map(x => x.r)) });
    }).filter(m => m.rets.length >= 60);
    C = LM.corrMatrix(markets.map(m => m.rets), N_CORR, MIN_SHARED);
    P = markets.length ? LM.layout(C, 0.46, 1.35, 0.95) : [];
    SD_MED = LM.quantile(markets.map(m => m.st.sd).sort((a, b) => a - b), 0.5) || 1e-6;
    sel = Math.max(0, markets.findIndex(m => m.id === keep));
    return true;
  }

  function select(i) {
    if (i === sel || !markets[i]) return;
    sel = i;
    renderReadouts();
    if (field) { field.apply(); dens.rebuild(); }
  }

  // ---------- top bar ----------
  function renderTabs() {
    const key = markets.map(m => m.id).join(',');
    if (key !== tabKey) {
      tabKey = key;
      const tabs = $('tabs'); tabs.textContent = '';
      let lastKind = null;
      markets.forEach((m, i) => {
        if (m.kind !== lastKind) {
          const s = document.createElement('span');
          s.className = 'tabgroup'; s.textContent = m.kind; tabs.appendChild(s); lastKind = m.kind;
        }
        const b = document.createElement('button');
        b.type = 'button'; b.className = 'tab'; b.textContent = m.id; b.title = m.name;
        b.setAttribute('aria-label', m.id + ', ' + m.name);
        b.addEventListener('click', () => select(i));
        tabs.appendChild(b); m.tab = b;
      });
    } else {
      const btns = $('tabs').querySelectorAll('.tab');
      markets.forEach((m, i) => { m.tab = btns[i]; });
    }
    markets.forEach((m, i) => m.tab.setAttribute('aria-pressed', String(i === sel)));
  }

  // CME futures: closed Fri 16:00 to Sun 17:00 CT, plus 16:00 to 17:00 CT Monday to Thursday.
  const wf = new Intl.DateTimeFormat('en-US', { timeZone: TZ, weekday: 'short', hour: '2-digit', hourCycle: 'h23' });
  function futuresClosed(t) {
    const parts = wf.formatToParts(new Date(t * 1000));
    const day = parts.find(p => p.type === 'weekday').value, hour = Number(parts.find(p => p.type === 'hour').value);
    if (day === 'Sat') return true;
    if (day === 'Sun') return hour < 17;
    if (day === 'Fri') return hour >= 16;
    return hour === 16;
  }

  function renderStatus() {
    const now = Date.now() / 1000;
    let code, text;
    if (!markets.length) {
      code = loadErr ? 'OFFLINE' : 'LOADING';
      text = loadErr ? 'no data yet · trying again every minute' : 'fetching bars';
    } else {
      const m = markets[sel], bar = m.bars[m.bars.length - 1].t, age = now - (bar + LM.STEP);
      if (!LIVE) { code = 'SNAPSHOT'; text = fmtDay(bar) + ' · ' + fmtClock(bar) + ' CT · not live'; }
      else {
        code = age < 420 ? 'LIVE' : m.kind === 'Futures' && futuresClosed(now) ? 'CLOSED' : age < 1800 ? 'DELAYED' : 'STALE';
        text = 'last bar ' + fmtTime(bar) + ' CT';
        if (code === 'DELAYED' || code === 'STALE') text += ' · ' + ago(age) + ' behind';
        text += ' · checked ' + ago(now - lastOk) + ' ago';
      }
    }
    $('status').dataset.code = code;
    $('statusCode').textContent = code;
    $('statusText').textContent = text;
  }

  function renderInfo() {
    const groups = {};
    markets.forEach(m => { (groups[m.kind] = groups[m.kind] || { src: m.src, ids: [] }).ids.push(m.id); });
    const src = Object.keys(groups).map(k => k + ' (' + groups[k].ids.join(', ') + '): ' + groups[k].src + '.').join(' ');
    $('infoData').textContent = LIVE
      ? 'The page asks for new bars every minute. ' + src + ' Futures prices are reference data and can run several minutes behind; the badge at the top shows how far. A market that fails to load is left out until it comes back.'
      : 'This page is a snapshot of one session, not a live feed. ' + src + ' ' + (CFG.snap.note || '');
  }

  // ---------- readouts ----------
  function renderSummary() {
    const m = markets[sel], first = m.view[0], last = m.view[m.view.length - 1];
    $('symId').textContent = m.id;
    $('symName').textContent = m.name + ' · ' + m.src;
    $('fLast').textContent = fmtPrice(last.c, m.dec);
    const chg = (last.c / first.c - 1) * 100;
    $('fChgLabel').textContent = 'Since ' + fmtTime(first.t) + ' CT';
    $('fChg').textContent = signed(chg, 2) + '%'; $('fChg').className = cls(chg);
    $('fSd').textContent = m.st.sd.toFixed(3) + '%';
    $('fBar').textContent = fmtDay(last.t) + ' · ' + fmtClock(last.t) + ' CT';
    $('fieldSub').textContent = 'Closer together means moving together. The number under each market is its correlation with ' + m.id + '.';
  }

  function renderCorr() {
    const m = markets[sel];
    $('corrSym').textContent = m.id;
    const rows = markets.map((x, i) => ({ x, i, c: C[sel][i] })).filter(o => o.i !== sel)
      .sort((a, b) => (b.c.r === null ? -1 : Math.abs(b.c.r)) - (a.c.r === null ? -1 : Math.abs(a.c.r)));
    const ol = $('corrList'); ol.textContent = '';
    rows.forEach(o => {
      const li = document.createElement('li');
      const b = document.createElement('button'); b.type = 'button'; b.className = 'crow';
      const s = document.createElement('span'); s.className = 's'; s.textContent = o.x.id;
      const n = document.createElement('span'); n.className = 'n'; n.textContent = o.x.name;
      const tr = document.createElement('span'); tr.className = 'track';
      const v = document.createElement('span'); v.className = 'v';
      if (o.c.r === null) {
        v.textContent = 'n/a'; n.textContent = o.x.name + ' · not measured';
        b.setAttribute('aria-label', o.x.id + ', not measured: only ' + o.c.n + ' shared returns');
      } else {
        const f = document.createElement('i'), w = Math.abs(o.c.r) * 50;
        f.style.width = w.toFixed(1) + '%';
        f.style.left = (o.c.r >= 0 ? 50 : 50 - w).toFixed(1) + '%';
        f.style.background = o.c.r >= 0 ? 'var(--up)' : 'var(--down)';
        tr.appendChild(f);
        v.textContent = signed(o.c.r, 2); v.classList.add(o.c.r >= 0 ? 'up' : 'down');
        b.setAttribute('aria-label', o.x.id + ', correlation ' + o.c.r.toFixed(2));
      }
      b.append(s, n, tr, v);
      b.addEventListener('click', () => select(o.i));
      li.appendChild(b); ol.appendChild(li);
    });
    const meas = rows.filter(o => o.c.r !== null);
    if (!meas.length) { $('corrNote').textContent = 'No pair has enough shared returns to measure right now.'; return; }
    const nShared = Math.min.apply(null, meas.map(o => o.c.n));
    const newest = Math.max.apply(null, meas.map(o => o.c.asOf)), oldest = Math.min.apply(null, meas.map(o => o.c.asOf));
    let note = 'Pearson correlation on the last ' + nShared + ' five-minute returns each pair shares, ending ' + fmtTime(newest) + ' CT. +1 is moving in lockstep, 0 is unrelated, −1 is moving opposite.';
    if (newest - oldest > 900) note += ' Pairs with a closed market use the last session both traded, ending ' + fmtTime(oldest) + ' CT.';
    $('corrNote').textContent = note;
  }

  function renderDist() {
    const m = markets[sel], r = m.recent;
    surface = LM.densitySurface(m.dens);
    let up = 0, down = 0, bi = 0, si = 0;
    r.forEach((x, k) => { if (x.r > 0) up++; else if (x.r < 0) down++; if (x.r > r[bi].r) bi = k; if (x.r < r[si].r) si = k; });
    const lastS = surface.slices[surface.slices.length - 1];
    const items = [
      ['Up / down / flat', up + ' / ' + down + ' / ' + (r.length - up - down), 'bars'],
      ['Largest up move', signed(r[bi].r, 3) + '%', fmtTime(r[bi].t) + ' CT bar'],
      ['Largest down move', signed(r[si].r, 3) + '%', fmtTime(r[si].t) + ' CT bar'],
      ['Typical move', m.st.sd.toFixed(3) + '%', 'standard deviation, per 5 min'],
      ['Latest return', signed(r[r.length - 1].r, 3) + '%', fmtTime(r[r.length - 1].t) + ' CT bar'],
      ['Smoothing width', lastS ? lastS.h.toFixed(3) + '%' : 'n/a', 'latest ridge']
    ];
    const dl = $('dist'); dl.textContent = '';
    items.forEach(it => {
      const d = document.createElement('div'), dt = document.createElement('dt'), dd = document.createElement('dd'), sm = document.createElement('small');
      dt.textContent = it[0]; dd.textContent = it[1]; sm.textContent = it[2]; dd.appendChild(sm); d.append(dt, dd); dl.appendChild(d);
    });
    $('distTitle').textContent = m.id + ' · last ' + r.length + ' five-minute returns';
    $('distNote').textContent = 'Covers ' + fmtTime(r[0].t) + ' to ' + fmtTime(r[r.length - 1].t) + ' CT.';
    $('densSub').textContent = 'Each ridge is ' + surface.win + ' returns (' + (surface.win * 5 / 60) + ' hours). The front ridge is the latest.';
  }

  function renderReadouts() {
    renderTabs(); renderStatus();
    if (!markets.length) return;
    renderSummary(); renderCorr(); renderDist(); renderInfo();
  }

  // ---------- controls ----------
  const dlg = $('info');
  $('btnInfo').addEventListener('click', () => { if (dlg.showModal) dlg.showModal(); else dlg.setAttribute('open', ''); });
  $('btnClose').addEventListener('click', () => { if (dlg.close) dlg.close(); else dlg.removeAttribute('open'); });
  dlg.addEventListener('click', e => { if (e.target === dlg && dlg.close) dlg.close(); });
  const btnPause = $('btnPause');
  function showPause() { btnPause.textContent = paused ? 'Play' : 'Pause'; btnPause.setAttribute('aria-pressed', String(paused)); }
  btnPause.addEventListener('click', () => { paused = !paused; showPause(); });
  showPause();
  $('btnReset').addEventListener('click', () => { if (field) { field.home(); dens.home(); } });

  // ---------- data in ----------
  function onData() {
    renderReadouts();
    if (!markets.length || glFailed) return;
    if (field) { field.rebuild(); dens.rebuild(); return; }
    if (!window.THREE) { noGL(); return; }
    try { field = buildField(); dens = buildDensity(); } catch (err) { console.error(err); field = dens = null; noGL(); return; }
    let clock = 0, prev = performance.now();
    const loop = now => {
      const dt = Math.min(0.05, (now - prev) / 1000); prev = now;
      if (!paused) clock += dt;
      if (!document.hidden) { field.frame(clock); dens.frame(clock); }
      requestAnimationFrame(loop);
    };
    requestAnimationFrame(loop);
  }

  async function refresh() {
    try {
      const res = await fetch(CFG.api, { cache: 'no-store' });
      if (!res.ok) throw new Error('HTTP ' + res.status);
      const j = await res.json();
      const list = (j.markets || []).map(m => Object.assign({}, m, { bars: m.t.map((t, i) => ({ t, c: m.c[i] })) }));
      lastOk = Date.now() / 1000; loadErr = false;
      if (ingest(list)) onData(); else renderStatus();
    } catch (err) {
      console.error(err); loadErr = true; renderStatus();
    }
  }

  renderStatus();
  if (LIVE) {
    refresh();
    setInterval(refresh, (CFG.every || 60) * 1000);
    setInterval(renderStatus, 15000);
  } else {
    ingest(CFG.snap.markets.map(m => Object.assign({}, m, { bars: LM.decode(m, CFG.snap.t0) })));
    onData();
  }

  // ---------- 3D ----------
  function noGL() {
    glFailed = true;
    ['fieldView', 'densView'].forEach(id => {
      const p = document.createElement('p'); p.className = 'nogl';
      p.textContent = 'The 3D view is not available in this browser. The numbers below still work.';
      $(id).appendChild(p);
    });
  }

  function geo(pos, col) {
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    if (col) g.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    return g;
  }

  function clear(group) {
    group.traverse(o => { if (o.geometry) o.geometry.dispose(); if (o.material) o.material.dispose(); });
    while (group.children.length) group.remove(group.children[0]);
  }

  function glowTexture() {
    const c = document.createElement('canvas'); c.width = c.height = 64;
    const g = c.getContext('2d'), gr = g.createRadialGradient(32, 32, 0, 32, 32, 32);
    gr.addColorStop(0, 'rgba(255,255,255,1)'); gr.addColorStop(0.3, 'rgba(255,255,255,0.6)'); gr.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = gr; g.fillRect(0, 0, 64, 64);
    return new THREE.CanvasTexture(c);
  }

  function makeView(el, opt) {
    const canvas = el.querySelector('canvas');
    const renderer = new THREE.WebGLRenderer({ canvas, antialias: true });
    renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    renderer.setClearColor(0x070a11, 1);
    const scene = new THREE.Scene();
    if (opt.fog) scene.fog = new THREE.Fog(0x070a11, 1, 10);
    const camera = new THREE.PerspectiveCamera(opt.fov, 1, 0.1, 60);
    const world = new THREE.Group(); scene.add(world);
    const v = { el, renderer, scene, camera, world, w: 1, h: 1, dist: 5, vf: opt.fov * Math.PI / 180,
      base: opt.home.clone(), target: opt.home.clone(), dragging: false };
    function resize() {
      const r = el.getBoundingClientRect();
      v.w = Math.max(1, Math.round(r.width)); v.h = Math.max(1, Math.round(r.height));
      renderer.setSize(v.w, v.h, false);
      camera.aspect = v.w / v.h;
      const hfov = 2 * Math.atan(Math.tan(v.vf / 2) * camera.aspect);
      v.dist = opt.radius / Math.sin(Math.min(v.vf, hfov) / 2);
      camera.position.set(0, 0, v.dist);
      camera.updateProjectionMatrix();
      if (scene.fog) { scene.fog.near = v.dist - 0.3; scene.fog.far = v.dist + 2.8; }
    }
    if (window.ResizeObserver) new ResizeObserver(resize).observe(el); else window.addEventListener('resize', resize);
    resize();
    const qa = new THREE.Quaternion(), AX = new THREE.Vector3(1, 0, 0), AY = new THREE.Vector3(0, 1, 0);
    v.turn = (dx, dy) => {
      v.base.premultiply(qa.setFromAxisAngle(AY, dx)).premultiply(qa.setFromAxisAngle(AX, dy));
      v.target.copy(v.base);
    };
    let px = 0, py = 0;
    canvas.addEventListener('pointerdown', e => { v.dragging = true; px = e.clientX; py = e.clientY; try { canvas.setPointerCapture(e.pointerId); } catch (_) {} });
    canvas.addEventListener('pointermove', e => { if (!v.dragging) return; v.turn((e.clientX - px) * 0.008, (e.clientY - py) * 0.008); px = e.clientX; py = e.clientY; });
    const end = () => { v.dragging = false; };
    canvas.addEventListener('pointerup', end); canvas.addEventListener('pointercancel', end);
    el.addEventListener('keydown', e => {
      const k = { ArrowLeft: [-0.12, 0], ArrowRight: [0.12, 0], ArrowUp: [0, -0.12], ArrowDown: [0, 0.12] }[e.key];
      if (!k) return; e.preventDefault(); v.turn(k[0], k[1]);
    });
    const sway = new THREE.Quaternion(), eu = new THREE.Euler();
    v.orient = (pitch, yaw) => {
      if (!v.dragging) v.base.slerp(v.target, 0.07);
      sway.setFromEuler(eu.set(pitch, yaw, 0));
      world.quaternion.copy(sway).multiply(v.base);
    };
    const tmp = new THREE.Vector3();
    // project a point given in `obj` local space to pixels in this view (z is its world depth)
    v.project = (obj, local) => {
      tmp.copy(local).applyMatrix4(obj.matrixWorld);
      const z = tmp.z;
      tmp.project(camera);
      return { x: (tmp.x * 0.5 + 0.5) * v.w, y: (-tmp.y * 0.5 + 0.5) * v.h, z };
    };
    v.put = (node, x, y) => { node.style.transform = 'translate(' + x.toFixed(1) + 'px,' + y.toFixed(1) + 'px) translate(-50%,-50%)'; };
    return v;
  }

  // ---------- correlation map ----------
  function buildField() {
    const v = makeView($('fieldView'), { fov: 36, radius: 1.68, home: new THREE.Quaternion(), fog: true });
    const labels = $('fieldLabels');
    const glow = glowTexture();
    const R0 = 0.04, RS = 0.2, SEG = 28, FRONT = new THREE.Vector3(0, 0, 1);
    const add = { transparent: true, blending: THREE.AdditiveBlending, depthWrite: false };

    // faint globe
    const gr = [], R = 1.46, SEGS = 96;
    const circle = fn => { for (let i = 0; i < SEGS; i++) { const a = fn(i / SEGS * 2 * Math.PI), b = fn((i + 1) / SEGS * 2 * Math.PI); gr.push(a[0], a[1], a[2], b[0], b[1], b[2]); } };
    circle(t => [R * Math.cos(t), 0, R * Math.sin(t)]);
    circle(t => [R * Math.cos(t), R * Math.sin(t), 0]);
    circle(t => [0, R * Math.cos(t), R * Math.sin(t)]);
    v.world.add(new THREE.LineSegments(geo(gr), new THREE.LineBasicMaterial({ color: 0x24324f, transparent: true, opacity: 0.45 })));

    const dyn = new THREE.Group(); v.world.add(dyn);
    let nodes = [], pairs = [], linkGeo = null, first = true;

    function rebuild() {
      clear(dyn); labels.textContent = '';
      nodes = markets.map((m, i) => {
        const g = new THREE.Group(); g.position.set(P[i][0], P[i][1], P[i][2]); dyn.add(g);
        // burst: the last 120 returns as a clock, oldest at 12 and running clockwise
        const K = m.recent.length, pos = [], col = [], tips = [], tcol = [];
        for (let k = 0; k < K; k++) {
          const r = m.recent[k].r, ang = Math.PI / 2 - 2 * Math.PI * k / K;
          const len = Math.min(Math.sqrt(Math.abs(r) / (4 * SD_MED)), 1);
          const r1 = R0 + RS * len, c = r >= 0 ? UP : DOWN, f = 0.22 + 0.78 * (k / Math.max(1, K - 1));
          const cx = Math.cos(ang), sy = Math.sin(ang);
          pos.push(R0 * cx, R0 * sy, 0, r1 * cx, r1 * sy, 0);
          col.push(c[0] * f * 0.3, c[1] * f * 0.3, c[2] * f * 0.3, c[0] * f, c[1] * f, c[2] * f);
          tips.push(r1 * cx, r1 * sy, 0); tcol.push(c[0] * f, c[1] * f, c[2] * f);
        }
        const spokes = new THREE.LineSegments(geo(pos, col), new THREE.LineBasicMaterial(Object.assign({ vertexColors: true }, add)));
        const pts = new THREE.Points(geo(tips, tcol), new THREE.PointsMaterial(Object.assign({ size: 0.034, map: glow, vertexColors: true }, add)));
        const core = new THREE.Points(geo([0, 0, 0]), new THREE.PointsMaterial(Object.assign({ size: 0.12, map: glow, color: 0xcfe0ff }, add)));
        g.add(spokes, pts, core);
        const b = document.createElement('button'); b.type = 'button'; b.className = 'nlabel';
        const s = document.createElement('b'), r = document.createElement('i');
        s.textContent = m.id; b.append(s, r); b.addEventListener('click', () => select(i));
        labels.appendChild(b);
        return { g, spokes, pts, core, b, r, pos: g.position };
      });

      // links only for pairs that were actually measured
      pairs = [];
      for (let i = 0; i < markets.length; i++) for (let j = i + 1; j < markets.length; j++) {
        const c = C[i][j];
        if (c.r !== null && Math.abs(c.r) >= LINK_MIN) pairs.push({ i, j, r: c.r });
      }
      const lp = [], a = new THREE.Vector3(), b = new THREE.Vector3(), mid = new THREE.Vector3(), ctl = new THREE.Vector3();
      const bez = t => { const u = 1 - t; return [u * u * a.x + 2 * u * t * ctl.x + t * t * b.x, u * u * a.y + 2 * u * t * ctl.y + t * t * b.y, u * u * a.z + 2 * u * t * ctl.z + t * t * b.z]; };
      pairs.forEach(p => {
        a.copy(nodes[p.i].pos); b.copy(nodes[p.j].pos); mid.addVectors(a, b).multiplyScalar(0.5);
        const out = mid.length() > 0.05 ? mid.clone().normalize() : new THREE.Vector3(0, 1, 0);
        ctl.copy(mid).addScaledVector(out, 0.3 * a.distanceTo(b));
        for (let s = 0; s < SEG; s++) { const q = bez(s / SEG), w = bez((s + 1) / SEG); lp.push(q[0], q[1], q[2], w[0], w[1], w[2]); }
      });
      linkGeo = geo(lp, new Float32Array(lp.length));
      dyn.add(new THREE.LineSegments(linkGeo, new THREE.LineBasicMaterial(Object.assign({ vertexColors: true }, add))));
      apply();
      if (first) { v.base.copy(v.target); first = false; }
    }

    function apply() {
      const arr = linkGeo.attributes.color.array;
      pairs.forEach((p, n) => {
        const on = p.i === sel || p.j === sel, c = p.r > 0 ? UP : DOWN;
        const f = on ? 0.3 + 0.7 * Math.abs(p.r) : 0.05 + 0.1 * Math.abs(p.r);
        for (let k = n * SEG * 6, e = k + SEG * 6; k < e; k += 3) { arr[k] = c[0] * f; arr[k + 1] = c[1] * f; arr[k + 2] = c[2] * f; }
      });
      linkGeo.attributes.color.needsUpdate = true;
      nodes.forEach((n, i) => {
        const on = i === sel, c = C[sel][i];
        n.spokes.material.opacity = on ? 1 : 0.6; n.pts.material.opacity = on ? 1 : 0.6;
        n.core.material.size = on ? 0.2 : 0.11; n.core.material.color.set(on ? 0xffffff : 0x9fbfff);
        n.b.className = 'nlabel' + (on ? ' sel' : c.r === null ? '' : c.r >= 0 ? ' pos' : ' neg');
        n.r.textContent = on ? '' : c.r === null ? 'not measured' : signed(c.r, 2);
        n.b.setAttribute('aria-label', on ? markets[i].id + ', selected' : markets[i].id + (c.r === null ? ', not measured' : ', correlation ' + c.r.toFixed(2)));
      });
      face();
    }

    // turn the map so the selected market faces the viewer
    function face() {
      const p = nodes[sel] && nodes[sel].pos;
      if (p && p.length() > 0.05) v.target.setFromUnitVectors(p.clone().normalize(), FRONT); else v.target.identity();
    }

    rebuild();
    const inv = new THREE.Quaternion(), tan = Math.tan(v.vf / 2);
    return {
      rebuild, apply, home: face,
      frame(t) {
        v.orient(0.06 * Math.sin(t * 0.21), 0.2 * Math.sin(t * 0.17));
        inv.copy(v.world.quaternion).invert();
        nodes.forEach(n => n.g.quaternion.copy(inv));
        v.renderer.render(v.scene, v.camera);
        // labels sit under each burst; nearer labels keep their spot and farther ones step down out of the way
        const spots = nodes.map((n, i) => {
          const q = v.project(v.world, n.pos);
          q.y += (R0 + RS) / (2 * (v.dist - q.z) * tan) * v.h + 14;
          q.n = n; q.sel = i === sel ? 1 : 0;
          return q;
        }).sort((p1, p2) => (p2.sel - p1.sel) || (p2.z - p1.z));
        spots.forEach((q, k) => {
          q.w = q.n.b.offsetWidth || 60; q.h = q.n.b.offsetHeight || 34;
          q.x = Math.max(q.w / 2 + 4, Math.min(v.w - q.w / 2 - 4, q.x));
          const dir = q.y + q.h * 1.5 > v.h ? -1 : 1; // near the bottom edge, step up instead of down
          for (let tries = 0; tries < 12; tries++) {
            const hit = spots.slice(0, k).find(o => Math.abs(o.x - q.x) < (o.w + q.w) / 2 && Math.abs(o.y - q.y) < (o.h + q.h) / 2);
            if (!hit) break;
            q.y = hit.y + dir * ((hit.h + q.h) / 2 + 1);
          }
          q.y = Math.max(q.h / 2 + 2, Math.min(v.h - q.h / 2 - 2, q.y));
          v.put(q.n.b, q.x, q.y);
          q.n.b.style.opacity = Math.max(0.5, Math.min(1, 0.75 + q.z * 0.2)).toFixed(2);
          q.n.b.style.zIndex = String(Math.round((q.z + 3) * 100));
        });
      }
    };
  }

  // ---------- density surface ----------
  function buildDensity() {
    const home = new THREE.Quaternion().setFromEuler(new THREE.Euler(0.5, -0.62, 0, 'XYZ'));
    const v = makeView($('densView'), { fov: 36, radius: 1.68, home });
    const labels = $('densLabels');
    const root = new THREE.Group(); root.position.set(0.1, -0.22, 0); v.world.add(root);
    const XW = 1.25, ZW = 0.85, YH = 0.8;
    let marks = [];

    function label(text, x, y, z, kind) {
      const s = document.createElement('span'); s.className = 'dlabel' + (kind ? ' ' + kind : ''); s.textContent = text;
      labels.appendChild(s); marks.push({ s, p: new THREE.Vector3(x, y, z) });
    }
    function mix(t, f) { return [(DOWN[0] + (UP[0] - DOWN[0]) * t) * f, (DOWN[1] + (UP[1] - DOWN[1]) * t) * f, (DOWN[2] + (UP[2] - DOWN[2]) * t) * f]; }

    function rebuild() {
      clear(root); labels.textContent = ''; marks = [];
      const S = surface, ns = S.slices.length, G = S.xs.length;
      if (!ns || !(S.peak > 0)) { label('Not enough bars yet', 0, 0.2, 0, 'hot'); return; }
      const X = i => S.xs[i] / S.xmax * XW, Z = s => (ns > 1 ? -ZW + 2 * ZW * s / (ns - 1) : 0);
      const Y = (s, i) => S.slices[s].dens[i] / S.peak * YH;
      const side = i => Math.max(0, Math.min(1, S.xs[i] / S.xmax / 0.1 * 0.5 + 0.5));

      // filled surface: orange left of zero, blue right of zero, brighter where returns were more common
      const pos = [], col = [], idx = [];
      for (let s = 0; s < ns; s++) for (let i = 0; i < G; i++) {
        const y = Y(s, i), c = mix(side(i), 0.06 + 0.5 * Math.pow(y / YH, 0.8));
        pos.push(X(i), y, Z(s)); col.push(c[0], c[1], c[2]);
      }
      for (let s = 0; s < ns - 1; s++) for (let i = 0; i < G - 1; i++) {
        const p = s * G + i; idx.push(p, p + G, p + 1, p + 1, p + G, p + G + 1);
      }
      const sg = geo(pos, col); sg.setIndex(idx);
      root.add(new THREE.Mesh(sg, new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, polygonOffset: true, polygonOffsetFactor: 1, polygonOffsetUnits: 1 })));

      // wire: one line per ridge, plus a cross line every 4th grid step
      const wp = [], wc = [];
      const seg = (s0, i0, s1, i1) => {
        const y0 = Y(s0, i0), y1 = Y(s1, i1);
        const c0 = mix(side(i0), 0.2 + 0.8 * Math.pow(y0 / YH, 0.7)), c1 = mix(side(i1), 0.2 + 0.8 * Math.pow(y1 / YH, 0.7));
        wp.push(X(i0), y0 + 0.003, Z(s0), X(i1), y1 + 0.003, Z(s1)); wc.push(c0[0], c0[1], c0[2], c1[0], c1[1], c1[2]);
      };
      for (let s = 0; s < ns; s++) for (let i = 0; i < G - 1; i++) seg(s, i, s, i + 1);
      for (let i = 0; i < G; i += 4) for (let s = 0; s < ns - 1; s++) seg(s, i, s + 1, i);
      root.add(new THREE.LineSegments(geo(wp, wc), new THREE.LineBasicMaterial({ vertexColors: true })));

      // latest ridge in white
      const lr = [];
      for (let i = 0; i < G; i++) lr.push(X(i), Y(ns - 1, i) + 0.006, Z(ns - 1));
      root.add(new THREE.Line(geo(lr), new THREE.LineBasicMaterial({ color: 0xffffff })));

      // floor: tick lines, frame, zero guide
      const fl = [], zl = [], zf = ZW + 0.12, dec = Math.max(0, -Math.floor(Math.log10(S.tick) + 1e-9));
      const nt = Math.floor(S.xmax / S.tick + 1e-9);
      for (let k = -nt; k <= nt; k++) {
        const x = k * S.tick / S.xmax * XW;
        (k === 0 ? zl : fl).push(x, 0, -ZW, x, 0, zf);
        label(k === 0 ? '0' : signed(k * S.tick, dec), x, 0, zf + 0.12, k === 0 ? 'hot' : '');
      }
      fl.push(-XW, 0, -ZW, XW, 0, -ZW, -XW, 0, ZW, XW, 0, ZW, -XW, 0, -ZW, -XW, 0, ZW, XW, 0, -ZW, XW, 0, ZW);
      root.add(new THREE.LineSegments(geo(fl), new THREE.LineBasicMaterial({ color: 0x24324f })));
      root.add(new THREE.LineSegments(geo(zl), new THREE.LineBasicMaterial({ color: 0x7385a8 })));
      label('5-minute return (%)', 0, 0, zf + 0.62, 'title');
      label(fmtTime(S.slices[0].tEnd), -XW - 0.3, 0, -ZW);
      label(fmtTime(S.slices[ns - 1].tEnd) + ' · latest', -XW - 0.3, 0, ZW, 'hot');
    }
    rebuild();

    return {
      rebuild,
      home() { v.target.copy(home); },
      frame(t) {
        v.orient(0, 0.1 * Math.sin(t * 0.19));
        v.renderer.render(v.scene, v.camera);
        marks.forEach(k => {
          const q = v.project(root, k.p), hw = (k.s.offsetWidth || 40) / 2 + 6;
          v.put(k.s, Math.max(hw, Math.min(v.w - hw, q.x)), q.y);
        });
      }
    };
  }
})();
