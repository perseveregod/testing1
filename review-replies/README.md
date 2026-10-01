# ReplyDesk

AI replies to Google and Yelp reviews, written in a local business's own voice. Free for 15 replies a month, **$9/month** for Pro (300 replies).

- **Landing page** (`/`) with a live demo: visitors paste one of their own reviews and get a reply without signing up (3 free samples per day per visitor).
- **App** (`/app`): email/password accounts, a "Your voice" profile (business name, tone, sign-off, things to mention), a reviews inbox with *Needs reply / Ready to post / Posted* filters, one-click replies, inline editing, CSV import, and a monthly usage meter.
- **Billing**: Stripe Checkout subscriptions, the Stripe customer portal for cancelling or changing cards, and a signed webhook that switches accounts between Free and Pro.

## Run it locally

Needs Node 22.13 or newer (it uses Node's built-in SQLite).

```bash
npm install
npm start          # http://localhost:3000
npm test
```

With no keys set, it runs in demo mode: replies come from a simple template and the Upgrade button is disabled.

## Settings (environment variables)

| Variable | Needed for | Notes |
|---|---|---|
| `ANTHROPIC_API_KEY` | Real AI replies | From console.anthropic.com. |
| `MODEL` | Optional | Defaults to `claude-opus-5-5`. `claude-haiku-4-5` costs less per reply. |
| `STRIPE_SECRET_KEY` | Payments | From the Stripe dashboard (`sk_live_...` or `sk_test_...`). |
| `STRIPE_PRICE_ID` | Payments | The $9/month recurring price you create in Stripe (`price_...`). |
| `STRIPE_WEBHOOK_SECRET` | Payments | From the webhook endpoint you add in Stripe (`whsec_...`). |
| `PUBLIC_URL` | Production | Your site's address, e.g. `https://replydesk.com`. Used for Stripe redirects. Cookies are marked Secure when it starts with `https://`. |
| `TRUST_PROXY` | Production | Set to `1` behind Render, Railway or Fly so rate limits see real visitor IPs. |
| `DB_FILE` | Optional | SQLite file path. Defaults to `data/replydesk.db`. Put it on a persistent disk. |
| `PORT` | Optional | Defaults to 3000. |

## Launch checklist

1. **Stripe**: create a product "ReplyDesk Pro" with a $9/month recurring price and copy its price ID. Add a webhook endpoint at `https://YOUR-DOMAIN/api/billing/webhook` listening for `checkout.session.completed`, `customer.subscription.updated` and `customer.subscription.deleted`. Turn on the customer portal in Stripe's billing settings.
2. **Host**: deploy to Render, Railway or Fly.io with a persistent disk mounted for `data/`, and set the variables above.
3. **Test a payment** with Stripe test keys and card `4242 4242 4242 4242` before switching to live keys.
4. **Before charging real customers**, add a privacy policy and terms of service, and a way to reset forgotten passwords. Reset needs an email provider, which this MVP doesn't include yet.

## Code map

- `server.js`: HTTP server, routes, auth checks, Stripe checkout, portal and webhook.
- `lib/db.js`: SQLite schema and queries (users, sessions, business voice, reviews, monthly usage).
- `lib/auth.js`: scrypt password hashing and session cookies.
- `lib/replies.js`: the prompt, the Claude call, plan limits and the demo template.
- `lib/csv.js`: CSV import.
- `public/`: landing page, app and shared styles. Plain HTML and JS with no build step.
