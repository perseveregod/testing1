// GET /api/market -> completed 5-minute bars for every market, as { fetchedAt, markets, failed }.
// Futures come from Yahoo Finance's public chart endpoint (reference data, can lag).
// Crypto comes from Coinbase Exchange's public candles endpoint. No keys needed.

const STEP = 300;
const UA = 'Mozilla/5.0 (compatible; lara-observatory/1.0)';

const FUTURES = [
  { id: 'NQ', name: 'E-mini Nasdaq-100', dec: 2, yahoo: ['NQ=F'] },
  { id: 'ES', name: 'E-mini S&P 500', dec: 2, yahoo: ['ES=F'] },
  { id: 'CL', name: 'WTI Crude Oil', dec: 2, yahoo: ['CL=F'] },
  { id: 'GC', name: 'Gold', dec: 1, yahoo: ['GC=F'] },
  { id: 'DX', name: 'US Dollar Index', dec: 3, yahoo: ['DX=F', 'DX-Y.NYB'] },
  { id: 'ZN', name: '10-Year T-Note', dec: 3, yahoo: ['ZN=F'] },
];
const CRYPTO = [
  { id: 'BTC', name: 'Bitcoin', dec: 2, product: 'BTC-USD' },
  { id: 'ETH', name: 'Ethereum', dec: 2, product: 'ETH-USD' },
  { id: 'SOL', name: 'Solana', dec: 2, product: 'SOL-USD' },
  { id: 'XRP', name: 'XRP', dec: 4, product: 'XRP-USD' },
];

async function getJson(url) {
  const r = await fetch(url, { headers: { 'User-Agent': UA, Accept: 'application/json' }, signal: AbortSignal.timeout(7000) });
  if (!r.ok) throw new Error('HTTP ' + r.status);
  return r.json();
}

// Keep only finished bars that sit on the 5-minute grid, oldest first, one per timestamp.
function tidy(rows, now) {
  const m = new Map();
  for (const [t, c] of rows) if (t % STEP === 0 && t + STEP <= now && Number.isFinite(c) && c > 0) m.set(t, c);
  return [...m.entries()].sort((a, b) => a[0] - b[0]);
}

function parseYahoo(j, now) {
  const res = j && j.chart && j.chart.result && j.chart.result[0];
  const ts = res && res.timestamp, cl = res && res.indicators && res.indicators.quote && res.indicators.quote[0] && res.indicators.quote[0].close;
  if (!ts || !cl) return null;
  return tidy(ts.map((t, i) => [t, cl[i]]), now);
}

async function yahoo(symbols, now) {
  for (const sym of symbols) for (const host of ['query1', 'query2']) {
    try {
      const bars = parseYahoo(await getJson('https://' + host + '.finance.yahoo.com/v8/finance/chart/' + encodeURIComponent(sym) + '?interval=5m&range=5d'), now);
      if (bars && bars.length) return bars;
    } catch (_) { /* try the next host or symbol */ }
  }
  return null;
}

// Coinbase rows are [time, low, high, open, close, volume], newest first, at most 300 per request.
function parseCoinbase(rows) { return Array.isArray(rows) ? rows.map(r => [r[0], r[4]]) : []; }

async function coinbase(product, pages, now) {
  const rows = [];
  let end = now;
  for (let p = 0; p < pages; p++) {
    const start = end - 300 * STEP;
    try {
      rows.push(...parseCoinbase(await getJson('https://api.exchange.coinbase.com/products/' + product + '/candles?granularity=' + STEP +
        '&start=' + new Date(start * 1000).toISOString() + '&end=' + new Date(end * 1000).toISOString())));
    } catch (_) { break; }
    end = start;
  }
  return rows.length ? tidy(rows, now) : null;
}

async function load(now) {
  const fut = await Promise.all(FUTURES.map(async m => ({ m, kind: 'Futures', src: 'Yahoo Finance', bars: await yahoo(m.yahoo, now) })));
  // Crypto has to reach back to the last futures session, so weekend pairs are measured on bars both sides traded.
  let oldest = now - 300 * STEP;
  for (const f of fut) if (f.bars && f.bars.length) oldest = Math.min(oldest, f.bars[f.bars.length - 1][0] - 130 * STEP);
  const pages = Math.max(1, Math.min(4, Math.ceil((now - oldest) / (300 * STEP))));
  const cry = await Promise.all(CRYPTO.map(async m => ({ m, kind: 'Crypto', src: 'Coinbase', bars: await coinbase(m.product, pages, now) })));

  const markets = [], failed = [];
  for (const x of fut.concat(cry)) {
    if (!x.bars || x.bars.length < 100) { failed.push(x.m.id); continue; }
    const b = x.bars.slice(x.kind === 'Futures' ? -450 : -1200);
    markets.push({ id: x.m.id, name: x.m.name, kind: x.kind, src: x.src, dec: x.m.dec, t: b.map(r => r[0]), c: b.map(r => Number(r[1].toFixed(x.m.dec + 2))) });
  }
  return { fetchedAt: now, markets, failed };
}

module.exports = async (req, res) => {
  const out = await load(Math.floor(Date.now() / 1000));
  res.setHeader('Cache-Control', 'public, s-maxage=45, stale-while-revalidate=300');
  res.status(out.markets.length ? 200 : 502).json(out);
};
module.exports.load = load;
module.exports.parseYahoo = parseYahoo;
module.exports.tidy = tidy;
