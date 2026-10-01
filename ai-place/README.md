# AI Place

One shared canvas that keeps growing. Anyone can claim an empty tile next to the existing art, type an idea ("a frog wearing a crown"), and AI draws it as 16×16 pixel art. Everyone watching sees it appear live. It's like Reddit's r/place, except each tile is a whole AI-drawn sprite.

## Run it

```bash
npm install
npm start            # http://localhost:3000
```

With no API key, the app runs in **demo mode**: tiles come from a free placeholder generator, so you can try everything at no cost.

To use real AI drawings, set your Anthropic API key:

```bash
ANTHROPIC_API_KEY=sk-ant-... npm start
```

## Settings (environment variables)

| Variable | Default | What it does |
|---|---|---|
| `ANTHROPIC_API_KEY` | none | Turns on AI drawing. Without it the app uses demo mode. |
| `MODEL` | `claude-opus-5-5` | Which Claude model draws the tiles. `claude-haiku-4-5` is much cheaper per tile. |
| `COOLDOWN_SECONDS` | `60` | How long each visitor waits between tiles. |
| `PORT` | `3000` | HTTP port. |
| `DATA_FILE` | `data/canvas.json` | Where the canvas is saved. |
| `TRUST_PROXY` | off | Set to `1` behind a proxy or load balancer (Render, Railway, Fly) so cooldowns use the real visitor IP. |

## How it works

- `server.js` is a plain Node HTTP server with no framework. It serves the page, a JSON API (`GET/POST /api/tiles`), and a live update stream (`GET /api/stream`, Server-Sent Events).
- `lib/canvas.js` holds the canvas rules: the first tile goes at (0, 0), and each new tile must touch an existing one. It also handles prompt cleanup and per-IP cooldowns.
- `lib/art.js` asks Claude for a 16×16 grid in a fixed 16-color palette, then validates and normalizes the reply. Refusals and bad output become friendly errors, and a failed drawing doesn't use up the visitor's cooldown.
- `public/index.html` is the whole front end: a pan/zoom canvas, the draw form, a live feed, share links (`#t3_m2` means tile 3, -2), and a "Save canvas" PNG export.

## Deploying

Any host that runs Node 20+ with a persistent disk will work, such as Render, Railway or Fly.io. Mount a volume for `data/`, set `ANTHROPIC_API_KEY` and `TRUST_PROXY=1`, and start with `npm start`.

## Tests

```bash
npm test
```
