// ReplyDesk server: landing page, app, JSON API, and Stripe billing.

const http = require("http");
const fs = require("fs");
const path = require("path");
const { open, makeStore } = require("./lib/db");
const auth = require("./lib/auth");
const replies = require("./lib/replies");
const { reviewsFromCsv } = require("./lib/csv");

const PORT = Number(process.env.PORT) || 3000;
const DB_FILE = process.env.DB_FILE || path.join(__dirname, "data", "replydesk.db");
const MODEL = process.env.MODEL || replies.DEFAULT_MODEL;
const PUBLIC_URL = (process.env.PUBLIC_URL || `http://localhost:${PORT}`).replace(/\/$/, "");
const SECURE_COOKIES = PUBLIC_URL.startsWith("https://");
const TRUST_PROXY = process.env.TRUST_PROXY === "1";
const PUBLIC_DIR = path.join(__dirname, "public");

// Legal details shown on the Terms, Privacy and Refund pages and in the footer.
const TERMS_VERSION = "2026-10-01";
const SITE = {
  COMPANY_NAME: process.env.COMPANY_NAME || "ReplyDesk",
  CONTACT_EMAIL: process.env.CONTACT_EMAIL || "support@example.com",
  GOVERNING_LAW: process.env.GOVERNING_LAW || "the State of Delaware, USA",
  EFFECTIVE_DATE: "October 1, 2026",
  YEAR: String(new Date().getFullYear()),
};
const SITE_DEFAULTS = !process.env.CONTACT_EMAIL || !process.env.COMPANY_NAME || !process.env.GOVERNING_LAW;

let ai = null;
if (process.env.ANTHROPIC_API_KEY) {
  const Anthropic = require("@anthropic-ai/sdk");
  ai = new (Anthropic.default || Anthropic)();
}

let stripe = null;
const PRICE_ID = process.env.STRIPE_PRICE_ID;
const WEBHOOK_SECRET = process.env.STRIPE_WEBHOOK_SECRET;
if (process.env.STRIPE_SECRET_KEY && PRICE_ID) {
  const Stripe = require("stripe");
  stripe = new (Stripe.default || Stripe)(process.env.STRIPE_SECRET_KEY);
}

const store = makeStore(open(DB_FILE));

// ----- helpers -----

class Limiter {
  constructor(max, windowMs) { this.max = max; this.windowMs = windowMs; this.hits = new Map(); }
  take(id, now = Date.now()) {
    const h = this.hits.get(id);
    if (!h || h.reset <= now) { this.hits.set(id, { n: 1, reset: now + this.windowMs }); return true; }
    if (h.n >= this.max) return false;
    h.n++;
    return true;
  }
}
const demoLimiter = new Limiter(3, 24 * 60 * 60 * 1000);
const authLimiter = new Limiter(20, 15 * 60 * 1000);

const escapeHtml = (v) => String(v).replace(/[&<>"']/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" })[c]);
const fillTemplate = (html) => html.replace(/\{\{(\w+)\}\}/g, (m, k) => (k in SITE ? escapeHtml(SITE[k]) : m));

function securityHeaders(res) {
  res.setHeader("Content-Security-Policy", [
    "default-src 'self'",
    "script-src 'self' 'unsafe-inline'",
    "style-src 'self' 'unsafe-inline' https://fonts.googleapis.com",
    "font-src https://fonts.gstatic.com",
    "img-src 'self' data:",
    "connect-src 'self'",
    "frame-ancestors 'none'",
    "base-uri 'self'",
    "form-action 'self'",
  ].join("; "));
  res.setHeader("X-Content-Type-Options", "nosniff");
  res.setHeader("X-Frame-Options", "DENY");
  res.setHeader("Referrer-Policy", "strict-origin-when-cross-origin");
  res.setHeader("Permissions-Policy", "camera=(), microphone=(), geolocation=()");
  if (SECURE_COOKIES) res.setHeader("Strict-Transport-Security", "max-age=31536000; includeSubDomains");
}

function send(res, status, body, headers = {}) {
  res.writeHead(status, { "Content-Type": "application/json", "Cache-Control": "no-store", ...headers });
  res.end(JSON.stringify(body));
}

function ip(req) {
  if (TRUST_PROXY && req.headers["x-forwarded-for"]) return String(req.headers["x-forwarded-for"]).split(",")[0].trim();
  return req.socket.remoteAddress || "unknown";
}

function rawBody(req, limit = 1_000_000) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    let size = 0;
    req.on("data", (c) => {
      size += c.length;
      if (size > limit) { reject(Object.assign(new Error("too large"), { status: 413 })); req.destroy(); }
      else chunks.push(c);
    });
    req.on("end", () => resolve(Buffer.concat(chunks)));
    req.on("error", reject);
  });
}

async function json(req) {
  // Requiring a JSON content type blocks cross-site form posts (CSRF).
  if (!String(req.headers["content-type"] || "").includes("application/json")) {
    throw Object.assign(new Error("Send JSON."), { status: 415 });
  }
  try {
    return JSON.parse((await rawBody(req)).toString("utf8") || "{}");
  } catch (e) {
    throw Object.assign(new Error("That request wasn't valid JSON."), { status: e.status || 400 });
  }
}

function currentUser(req) {
  const token = auth.readCookie(req);
  return token ? store.sessionUser(token) : null;
}

function startSession(res, userId) {
  const token = auth.newToken();
  store.createSession(token, userId, auth.SESSION_TTL_MS);
  return { "Set-Cookie": auth.sessionCookie(token, { secure: SECURE_COOKIES }) };
}

function me(user) {
  return {
    email: user.email,
    business: store.business(user.id),
    quota: replies.quota(user.plan, store.usage(user.id)),
    billingEnabled: Boolean(stripe),
    hasSubscription: Boolean(user.stripe_customer_id),
    demo: !ai,
  };
}

async function generate(business, review) {
  return ai ? replies.writeReply(ai, business, review, MODEL) : replies.demoReply(business, review);
}

function replyError(res, err) {
  if (err instanceof replies.ReplyError) return send(res, 422, { error: err.message });
  console.error("reply failed:", err);
  send(res, 502, { error: "The AI is busy right now. Try again in a moment." });
}

// ----- routes -----

async function api(req, res, pathname) {
  const m = req.method;

  if (m === "POST" && pathname === "/api/billing/webhook") return webhook(req, res);

  if (m === "POST" && pathname === "/api/demo-reply") {
    const body = await json(req);
    const r = replies.cleanReview(body);
    if (r.error) return send(res, 400, { error: r.error });
    if (!demoLimiter.take(ip(req))) {
      return send(res, 429, { error: "You've used today's free samples. Create a free account for 15 replies a month." });
    }
    try {
      const reply = await generate({ name: String(body.businessName ?? ""), tone: body.tone }, r.review);
      return send(res, 200, { reply });
    } catch (err) {
      return replyError(res, err);
    }
  }

  if (m === "POST" && (pathname === "/api/signup" || pathname === "/api/login")) {
    if (!authLimiter.take(ip(req))) return send(res, 429, { error: "Too many attempts. Wait a few minutes and try again." });
    const body = await json(req);
    const c = auth.validateCredentials(body.email, body.password);
    if (c.error) return send(res, 400, { error: c.error });
    if (pathname === "/api/signup") {
      if (body.agreeToTerms !== true) {
        return send(res, 400, { error: "Please agree to the Terms of Service and Privacy Policy to create an account." });
      }
      if (store.userByEmail(c.email)) return send(res, 409, { error: "That email already has an account. Log in instead." });
      const id = store.createUser(c.email, auth.hashPassword(c.password), TERMS_VERSION);
      return send(res, 201, me(store.userById(id)), startSession(res, id));
    }
    const user = store.userByEmail(c.email);
    if (!user || !auth.verifyPassword(c.password, user.password_hash)) {
      return send(res, 401, { error: "That email and password don't match." });
    }
    return send(res, 200, me(user), startSession(res, user.id));
  }

  const user = currentUser(req);
  if (!user) return send(res, 401, { error: "Log in to continue." });

  if (m === "POST" && pathname === "/api/logout") {
    store.deleteSession(auth.readCookie(req));
    return send(res, 200, { ok: true }, { "Set-Cookie": auth.sessionCookie("", { secure: SECURE_COOKIES, maxAgeMs: 0 }) });
  }
  if (m === "GET" && pathname === "/api/me") return send(res, 200, me(user));

  if (m === "GET" && pathname === "/api/account/export") {
    return send(res, 200, store.exportData(user.id), {
      "Content-Disposition": `attachment; filename="replydesk-data-${new Date().toISOString().slice(0, 10)}.json"`,
    });
  }

  if (m === "POST" && pathname === "/api/account/delete") {
    const body = await json(req);
    if (!auth.verifyPassword(String(body.password ?? ""), user.password_hash)) {
      return send(res, 401, { error: "That password isn't right." });
    }
    if (user.stripe_customer_id) {
      if (!stripe) return send(res, 503, { error: `Billing is unavailable right now, so we can't cancel your subscription. Email ${SITE.CONTACT_EMAIL} and we'll delete your account.` });
      try {
        const subs = await stripe.subscriptions.list({ customer: user.stripe_customer_id, status: "all", limit: 100 });
        for (const sub of subs.data) {
          if (!["canceled", "incomplete_expired"].includes(sub.status)) await stripe.subscriptions.cancel(sub.id);
        }
      } catch (err) {
        console.error("subscription cancel failed:", err);
        return send(res, 502, { error: `We couldn't cancel your subscription automatically. Nothing was deleted. Try again, or email ${SITE.CONTACT_EMAIL}.` });
      }
    }
    store.deleteUser(user.id);
    return send(res, 200, { ok: true }, { "Set-Cookie": auth.sessionCookie("", { secure: SECURE_COOKIES, maxAgeMs: 0 }) });
  }

  if (m === "PUT" && pathname === "/api/business") {
    store.saveBusiness(user.id, replies.cleanBusiness(await json(req)));
    return send(res, 200, me(user));
  }

  if (m === "GET" && pathname === "/api/reviews") return send(res, 200, { reviews: store.reviews(user.id) });

  if (m === "POST" && pathname === "/api/reviews") {
    const body = await json(req);
    const incoming = body.csv !== undefined ? reviewsFromCsv(body.csv) : { reviews: [body] };
    if (incoming.error) return send(res, 400, { error: incoming.error });
    if (incoming.reviews.length > 200) return send(res, 400, { error: "Import up to 200 reviews at a time." });
    const added = [];
    const skipped = [];
    incoming.reviews.forEach((r, i) => {
      const c = replies.cleanReview(r);
      if (c.error) skipped.push({ row: i + 1, error: c.error });
      else added.push(store.addReview(user.id, c.review));
    });
    if (!added.length) return send(res, 400, { error: skipped[0]?.error || "No reviews to add.", skipped });
    return send(res, 201, { added: added.length, skipped, reviews: store.reviews(user.id) });
  }

  const one = /^\/api\/reviews\/(\d+)(\/reply)?$/.exec(pathname);
  if (one) {
    const id = Number(one[1]);
    const review = store.review(user.id, id);
    if (!review) return send(res, 404, { error: "That review no longer exists." });

    if (m === "POST" && one[2]) {
      const q = replies.quota(user.plan, store.usage(user.id));
      if (q.left <= 0) {
        return send(res, 402, {
          error: user.plan === "free"
            ? `You've used all ${q.limit} free replies this month. Upgrade to Pro for ${replies.PLANS.pro.monthlyReplies} a month.`
            : "You've reached this month's reply limit. It resets on the 1st.",
          quota: q,
        });
      }
      try {
        const text = await generate(store.business(user.id), review);
        store.addUsage(user.id);
        store.updateReview(user.id, id, { reply: text, status: "drafted" });
        return send(res, 200, { review: store.review(user.id, id), quota: replies.quota(user.plan, store.usage(user.id)) });
      } catch (err) {
        return replyError(res, err);
      }
    }
    if (m === "PATCH" && !one[2]) {
      const body = await json(req);
      const fields = {};
      if (typeof body.reply === "string") fields.reply = body.reply.slice(0, 5000);
      if (["new", "drafted", "posted"].includes(body.status)) fields.status = body.status;
      store.updateReview(user.id, id, fields);
      return send(res, 200, { review: store.review(user.id, id) });
    }
    if (m === "DELETE" && !one[2]) {
      store.deleteReview(user.id, id);
      return send(res, 200, { ok: true });
    }
  }

  if (m === "POST" && pathname === "/api/billing/checkout") {
    if (!stripe) return send(res, 503, { error: "Payments aren't set up yet." });
    const session = await stripe.checkout.sessions.create({
      mode: "subscription",
      line_items: [{ price: PRICE_ID, quantity: 1 }],
      client_reference_id: String(user.id),
      customer: user.stripe_customer_id || undefined,
      customer_email: user.stripe_customer_id ? undefined : user.email,
      allow_promotion_codes: true,
      custom_text: {
        submit: { message: "ReplyDesk Pro renews automatically every month until you cancel. Cancel anytime in the app under Manage billing." },
      },
      success_url: `${PUBLIC_URL}/app?upgraded=1`,
      cancel_url: `${PUBLIC_URL}/app`,
    });
    return send(res, 200, { url: session.url });
  }
  if (m === "POST" && pathname === "/api/billing/portal") {
    if (!stripe || !user.stripe_customer_id) return send(res, 400, { error: "No subscription to manage yet." });
    const portal = await stripe.billingPortal.sessions.create({
      customer: user.stripe_customer_id,
      return_url: `${PUBLIC_URL}/app`,
    });
    return send(res, 200, { url: portal.url });
  }

  send(res, 404, { error: "Not found" });
}

async function webhook(req, res) {
  if (!stripe || !WEBHOOK_SECRET) return send(res, 503, { error: "Billing is not configured." });
  let event;
  try {
    event = stripe.webhooks.constructEvent(await rawBody(req), req.headers["stripe-signature"], WEBHOOK_SECRET);
  } catch (err) {
    return send(res, 400, { error: `Webhook signature check failed: ${err.message}` });
  }
  const obj = event.data.object;
  if (event.type === "checkout.session.completed" && obj.mode === "subscription") {
    const userId = Number(obj.client_reference_id);
    if (store.userById(userId)) {
      store.setCustomer(userId, obj.customer);
      store.setPlan(userId, "pro");
    }
  } else if (event.type === "customer.subscription.updated" || event.type === "customer.subscription.deleted") {
    const user = store.userByCustomer(obj.customer);
    if (user) {
      const active = event.type === "customer.subscription.updated" && ["active", "trialing", "past_due"].includes(obj.status);
      store.setPlan(user.id, active ? "pro" : "free");
    }
  }
  send(res, 200, { received: true });
}

// ----- static files -----

const MIME = { ".html": "text/html; charset=utf-8", ".js": "text/javascript; charset=utf-8", ".css": "text/css; charset=utf-8", ".svg": "image/svg+xml", ".png": "image/png" };
const PAGES = { "/": "index.html", "/app": "app.html", "/terms": "terms.html", "/privacy": "privacy.html", "/refunds": "refunds.html" };

function serveStatic(res, pathname) {
  const rel = PAGES[pathname] || decodeURIComponent(pathname).replace(/^\/+/, "");
  const file = path.normalize(path.join(PUBLIC_DIR, rel));
  if (!file.startsWith(PUBLIC_DIR + path.sep)) return send(res, 404, { error: "Not found" });
  fs.readFile(file, (err, data) => {
    if (err) {
      res.writeHead(404, { "Content-Type": "text/plain" });
      return res.end("Not found");
    }
    const ext = path.extname(file);
    res.writeHead(200, { "Content-Type": MIME[ext] || "application/octet-stream" });
    res.end(ext === ".html" ? fillTemplate(data.toString("utf8")) : data);
  });
}

const server = http.createServer(async (req, res) => {
  const { pathname } = new URL(req.url, "http://localhost");
  securityHeaders(res);
  try {
    if (pathname.startsWith("/api/")) return await api(req, res, pathname);
    if (req.method === "GET") return serveStatic(res, pathname);
    send(res, 405, { error: "Method not allowed" });
  } catch (err) {
    if (err.status) return send(res, err.status, { error: err.message });
    console.error(err);
    send(res, 500, { error: "Something went wrong on our side." });
  }
});

if (require.main === module) {
  server.listen(PORT, () => {
    console.log(`ReplyDesk running on ${PUBLIC_URL}`);
    if (!ai) console.log("No ANTHROPIC_API_KEY: replies use a canned demo template.");
    if (!stripe) console.log("No STRIPE_SECRET_KEY/STRIPE_PRICE_ID: upgrade button is disabled.");
    if (stripe && !WEBHOOK_SECRET) console.log("WARNING: STRIPE_WEBHOOK_SECRET is not set, so paid upgrades will never activate.");
    if (SITE_DEFAULTS) console.log("WARNING: set COMPANY_NAME, CONTACT_EMAIL and GOVERNING_LAW before launch. The legal pages show placeholders until you do.");
  });
}

module.exports = { server };
