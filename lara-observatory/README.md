# LARA Market Observatory

A live 3D view of how futures and crypto markets are moving together, built from completed 5-minute bars.

- **Correlation map.** Markets that move together sit close together. Lines are drawn only for pairs that were actually measured (at least 30 shared returns, correlation of 0.35 or stronger).
- **Return density.** Ridges of how 5-minute returns were distributed through the session, latest at the front.
- **Status badge.** LIVE, DELAYED, CLOSED or STALE for the selected market, with the time of its last bar.

Reference data only. No broker connection, no orders, no predictions.

## Files

| File | What it does |
| --- | --- |
| `index.html` | Markup and styles. Loads three.js from cdnjs. |
| `math.js` | Returns, correlation, map layout and density maths. No dependencies. |
| `app.js` | Fetches `/api/market` every minute and draws the page. |
| `api/market.js` | Serverless function. Futures from Yahoo Finance's public chart endpoint, crypto from Coinbase Exchange. No API keys. |
| `test/` | `node --test lara-observatory/test/observatory.test.js` |

## Deploy on Vercel

1. Vercel dashboard: **Add New > Project**, import `perseveregod/testing1`.
2. Set **Root Directory** to `lara-observatory`. Framework preset: **Other**. No build command, no environment variables.
3. Deploy. The site is the project's production URL; the data is at `/api/market`.

Run locally with `npx vercel dev` from this folder.

## Data notes

- Markets: NQ, ES, CL, GC, DX (dollar index), ZN (10-year note), BTC, ETH, SOL, XRP.
- Yahoo's chart endpoint is unofficial and its futures prices are reference data that can run several minutes behind. If it refuses a request, that market is left out of the response (see `failed` in the JSON) and the page carries on with the rest.
- Only finished bars on the 5-minute grid are used. A gap between bars (daily futures break, weekend, missing bar) never counts as a 5-minute return.
- When futures are closed, pairs that include a futures market are measured on the last session both sides traded, and the page says so.
