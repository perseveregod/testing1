# Haven

A mobile-first community safety app: a live map and feed of nearby incidents, fast anonymous reporting, community confirmations, and alerts for the places you care about.

The core app is free. An optional **Haven Lifetime** upgrade is a **one-time payment with no subscription**. It unlocks a larger alert radius, more saved places, per-place alert rules, area insights, advanced filters, 90-day history and quiet hours.

> Haven is a temporary product name. The product, UI and copy are original.

## Run it

```bash
cd haven
npm install
npm run dev        # http://localhost:3000
```

No setup is needed. With no environment variables set, Haven uses:

- a **local JSON store** (`.data/haven.json`)
- **demo incidents** around Seattle. These are fictional and labeled `DEMO DATA` everywhere they appear.
- a **test checkout** that grants Lifetime without charging. It is only available outside production.
- **dev email sign-in**, where the 6-digit code is shown on screen and in the server log

Copy `.env.example` to `.env.local` to configure anything else.

```bash
npm test           # unit + service tests (vitest)
npm run typecheck
npm run lint
npm run build
```

## What's in the MVP

| Area | Details |
|---|---|
| Map | MapLibre with the free OpenFreeMap dark style, clustering, category markers, severity rings, a locate button, place search, filters, and a bottom-sheet preview with View details, Confirm and Share |
| Feed | Nearby, Newest, Police, Fire, Medical, Traffic, Weather and Other filters; distance, time, status and confirmation count |
| Incident details | Map preview, status, severity, timeline, source attribution; confirm, "it's over", add info, share, report a problem |
| Report | Category, location pin, details, review, done. Shows a duplicate warning before submit. Retried submits can't create duplicates (client request id). |
| Alerts | Inbox and settings: radius (1/3/5/10/25 mi), categories, saved-place alerts, near-me alerts, critical only, quiet hours (Lifetime), browser notifications |
| Profile | Guest account, email sign-in, saved places (Home/Work/School/Family/Custom), your reports, data sources, safety & privacy |
| Billing | Pricing comes from config; Stripe Checkout in `payment` mode, webhook and success-page confirmation; idempotent entitlements |

## Architecture

```
app/                 Next.js App Router: screens + /api route handlers
  (tabs)/            Map, Feed, Alerts, Profile, Incident, Upgrade (bottom nav)
  report/            Full-screen reporting flow
  api/               JSON API, also intended for a future native client
components/          UI by feature (map, feed, incident, report, alerts, profile, billing, ui)
lib/                 Shared domain: types, categories, geo, plans, moderation, validation (zod)
server/
  store/             Store interface + LocalStore (JSON) + SupabaseStore (Postgres)
  services/          Business rules: incidents, dedupe/merge, alerts, ingest
  sources/           Incident source adapters (demo, Seattle Fire 911, NWS alerts)
  billing/           Lifetime pricing, Stripe checkout and webhook
  auth/              Signed session tokens (cookie or Bearer), email OTP
supabase/migrations/ Postgres schema, indexes, geo functions, triggers, RLS
tests/               vitest suites
```

- **Server and client are kept apart.** All business rules run in `server/services` on the server. The client only calls `/api/*`. Plan limits are enforced on the server, never just hidden in the UI.
- **Native-ready.** Every screen uses the JSON API. A native app can send `X-Haven-Client: native` to `/api/me` to get a bearer token, then use `Authorization: Bearer …`.
- **Two stores, one interface.** If `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` are set, Postgres is used; otherwise the JSON file store. The SQL migration was run against Postgres 16, including the geo queries, counter triggers and GiST index plans.

### Data model

`users`, `entitlements`, `data_sources`, `incidents`, `incident_updates`, `incident_confirmations`, `incident_flags`, `reports`, `saved_locations`, `alert_preferences`, `notifications`.

- Geo queries use `cube`/`earthdistance` with GiST indexes (`incidents_nearby`, `alert_*_candidates`). Time queries use btree indexes on `updated_at`.
- `reports` keeps every raw submission. Several reports can point at one incident, which is how duplicates are merged. `incidents.merged_into_id` supports merging incidents later.
- Row Level Security is on for every table with no anon policies. Only the server's service-role key can read or write.

### Incident sources

Each feed is an adapter in `server/sources/` returning normalized incidents. Ingest upserts them by `(source, external_id)`. Ingest runs from `/api/cron/ingest`, and also on read (at most every `INGEST_INTERVAL_MIN` minutes), so it works without a scheduler.

| id | Source | Notes |
|---|---|---|
| `demo` | Fictional seed data | Default. Labeled DEMO DATA in the API and UI; regenerated every 6 h |
| `houston_active, seattle_fire_911` | Seattle Fire real-time 911 (data.seattle.gov) | Routine aid calls and alarms skipped; addresses reduced to the hundred-block, coordinates rounded to ~100 m |
| `nws_alerts` | US National Weather Service active alerts | Moderate and above; polygon center used; alerts that disappear from the feed are resolved |

To add a city, write an adapter (see `seattleFire.ts`) and list it in `server/sources/registry.ts`, then enable it with `INCIDENT_SOURCES=demo,seattle_fire_911,nws_alerts,<your_id>`.

## Trust & safety

- **Spam:** per-account hourly and daily report limits (stored in the database), per-IP burst limits, a guest-creation limit per IP, and idempotent submits.
- **Duplicates:** reports of the same category group within a per-category radius and time window are merged into the existing incident and count as a confirmation. The review screen warns before submitting.
- **False reports:** community reports show "unverified" until someone else confirms them. Flags hide a report for review (`FLAGS_TO_HIDE`). Reporters and the community can mark incidents ended. Inactive incidents read as ended automatically. Only official feeds or several confirmations can make something "critical".
- **Harassment and personal info:** server-side moderation rejects threats, slurs, doxxing phrasing and race-based descriptions. It removes phone numbers, emails, links, plates, @handles and house numbers.
- **Privacy:** reporter identity is never returned by the API. Report locations are snapped to ~100 m. Near-me alerts store one ~1 km point, which is deleted when the feature is turned off. Saved places are private.
- **Safety copy:** "If you are experiencing an emergency, call 911" appears on the report flow, feed, details and profile. Haven says plainly that it is not an emergency service, and asks people not to approach incidents.

The moderation rules are a first line of defense. Before launch, add a hosted moderation model and a human review queue for `under_review` incidents.

## Deploy in minutes

**Vercel (fastest).** Click the button, set the root directory to `haven/`, and add `SESSION_SECRET`. That's enough for a live demo on the local store with demo data. Add the Supabase and Stripe variables when you're ready for real users.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https%3A%2F%2Fgithub.com%2Fperseveregod%2Ftesting1&root-directory=haven&project-name=haven&env=SESSION_SECRET&envDescription=32%2B%20random%20characters%20(openssl%20rand%20-hex%2032))

**Any container host.** `docker build -t haven haven/ && docker run -p 3000:3000 -e SESSION_SECRET=... -v haven-data:/data haven`. Works on Fly.io, Railway, Render or a plain VPS; the volume keeps the local store between restarts.

**CI.** `.github/workflows/haven.yml` runs lint, typecheck, tests and a production build on every pull request and on `main`, so a green check means it's safe to deploy.

## Production setup

1. **Supabase.** Create a project and run `supabase/migrations/20261001000000_init.sql` in the SQL editor. Set `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY` and `SUPABASE_ANON_KEY`. For email sign-in, enable Email OTP and put `{{ .Token }}` in the magic-link email template.
2. **Session.** Set `SESSION_SECRET` (`openssl rand -hex 32`). In production, any request that needs a session fails until it is set.
3. **Stripe.** Set `STRIPE_SECRET_KEY` and either `STRIPE_LIFETIME_PRICE_ID` (a *one-time* price) or `LIFETIME_PRICE_CENTS`. Add a webhook to `/api/billing/webhook` for `checkout.session.completed` and `checkout.session.async_payment_succeeded`, then set `STRIPE_WEBHOOK_SECRET`. Locally: `stripe listen --forward-to localhost:3000/api/billing/webhook`.
4. **Vercel.** Set the project root to `haven/`. Set `CRON_SECRET`. `vercel.json` runs ingest daily, which is the Hobby-plan limit; on Pro, change it to every 5–10 minutes. Without Supabase, the local store lives in `/tmp` on Vercel and is lost between instances, so use Supabase in production.
5. **Map and search.** OpenFreeMap tiles and public Nominatim are fine for development. Nominatim allows about 1 request per second, which the app enforces. For real traffic, set `GEOCODER_URL` to your own or a commercial geocoder. If tile volume grows, consider `NEXT_PUBLIC_MAP_STYLE_URL` with a provider you control.

## Known gaps / next steps

- **Push notifications:** alerts land in the in-app inbox, and a browser notification shows while the app is open in the background. Web Push, APNs and FCM delivery plug in at the end of `dispatchAlerts` in `server/services/alerts.ts`.
- **Moderation:** add a moderator dashboard for flagged (`under_review`) incidents, and a hosted moderation model.
- **Rate limits:** the in-memory burst limiter is per instance. Move it to Redis/Upstash when running several instances. Per-account report limits are already durable.
- **Light mode** is not implemented; the app is dark-only by design for now.
- Have the Safety & Privacy copy reviewed by counsel before launch.


## Live incident feeds

| Source id | What it is | Needs |
| --- | --- | --- |
| `demo` | Labeled fictional incidents around the default center | nothing |
| `houston_active` | City of Houston Fire, EMS and Police dispatches (public page, refreshed every 5 min), placed with the free US Census geocoder | nothing (`HAVEN_CONTACT_EMAIL` is polite) |
| `seattle_fire_911` | Seattle Fire 911 dispatches from data.seattle.gov | nothing |
| `nws_alerts` | National Weather Service alerts with a polygon | `NWS_AREA` to limit to a state |

Set `INCIDENT_SOURCES` to a comma list. The default is `demo,houston_active`; drop `demo` once real data is flowing. Live feeds refresh after a response is sent (never on the request path), and new rows are geocoded a dozen at a time.

## Sign-in emails

With `RESEND_API_KEY` set, Haven emails 6-digit codes itself (no hourly cap). Otherwise it uses Supabase Auth's sender, whose default email carries a sign-in link that lands on `/auth/callback`. With neither, the code is shown on screen (development only).
