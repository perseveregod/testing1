const test = require("node:test");
const assert = require("node:assert");
const os = require("os");
const path = require("path");
const fs = require("fs");

const dir = fs.mkdtempSync(path.join(os.tmpdir(), "replydesk-"));
process.env.DB_FILE = path.join(dir, "test.db");
delete process.env.ANTHROPIC_API_KEY;
process.env.STRIPE_SECRET_KEY = "sk_test_dummy";
process.env.STRIPE_PRICE_ID = "price_dummy";
process.env.STRIPE_WEBHOOK_SECRET = "whsec_dummy";
process.env.OWNER_EMAIL = "boss@shop.co";
process.env.TRUST_PROXY = "1"; // so each test client below counts as a separate visitor for rate limits
const Stripe = require("stripe");
const { server } = require("../server");

let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

let visitors = 0;
function client() {
  let cookie = "";
  const address = `10.0.0.${++visitors}`;
  return async (method, p, body, headers = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}), "x-forwarded-for": address, ...headers },
      body: body === undefined ? undefined : typeof body === "string" ? body : JSON.stringify(body),
    });
    const set = res.headers.get("set-cookie");
    if (set) cookie = set.split(";")[0];
    return { status: res.status, body: await res.json().catch(() => null) };
  };
}

test("pages are served", async () => {
  for (const p of ["/", "/app", "/style.css", "/common.js"]) {
    assert.strictEqual((await fetch(base + p)).status, 200, p);
  }
  assert.strictEqual((await fetch(base + "/../server.js")).status, 404);
});

test("full flow: signup, voice, review, reply, quota, isolation", async () => {
  const c = client();
  assert.strictEqual((await c("GET", "/api/me")).status, 401);
  const signup = await c("POST", "/api/signup", { email: "owner@shop.co", password: "password123", agreeToTerms: true });
  assert.strictEqual(signup.status, 201);
  assert.strictEqual(signup.body.quota.limit, 15);
  assert.strictEqual((await c("POST", "/api/signup", { email: "OWNER@shop.co", password: "password123", agreeToTerms: true })).status, 409);

  await c("PUT", "/api/business", { name: "Rosa's", tone: "warm", signoff: "— Rosa" });
  const added = await c("POST", "/api/reviews", { rating: 5, reviewer: "Jamie L.", body: "Best tacos!" });
  assert.strictEqual(added.status, 201);
  const id = added.body.reviews[0].id;

  const rep = await c("POST", `/api/reviews/${id}/reply`, {});
  assert.strictEqual(rep.status, 200);
  assert.match(rep.body.review.reply, /Hi Jamie/);
  assert.match(rep.body.review.reply, /Rosa's/);
  assert.strictEqual(rep.body.quota.used, 1);

  const patched = await c("PATCH", `/api/reviews/${id}`, { status: "posted", reply: "Edited" });
  assert.strictEqual(patched.body.review.status, "posted");
  assert.strictEqual(patched.body.review.reply, "Edited");

  // another user can't touch it
  const other = client();
  await other("POST", "/api/signup", { email: "other@shop.co", password: "password123", agreeToTerms: true });
  assert.strictEqual((await other("POST", `/api/reviews/${id}/reply`, {})).status, 404);
  assert.strictEqual((await other("GET", "/api/reviews")).body.reviews.length, 0);

  // free quota runs out at 15
  for (let i = 1; i < 15; i++) assert.strictEqual((await c("POST", `/api/reviews/${id}/reply`, {})).status, 200);
  const blocked = await c("POST", `/api/reviews/${id}/reply`, {});
  assert.strictEqual(blocked.status, 402);
  assert.match(blocked.body.error, /Upgrade/);

  // logout ends the session
  await c("POST", "/api/logout", {});
  assert.strictEqual((await c("GET", "/api/me")).status, 401);
  const login = await c("POST", "/api/login", { email: "owner@shop.co", password: "password123", agreeToTerms: true });
  assert.strictEqual(login.status, 200);
  assert.strictEqual((await c("POST", "/api/login", { email: "owner@shop.co", password: "nope12345" })).status, 401);
});

test("CSV import and CSRF protection", async () => {
  const c = client();
  await c("POST", "/api/signup", { email: "csv@shop.co", password: "password123", agreeToTerms: true });
  const r = await c("POST", "/api/reviews", { csv: "rating,reviewer,review\n4,Al,Nice\n9,Bo,Bad rating\n" });
  assert.strictEqual(r.body.added, 1);
  assert.strictEqual(r.body.skipped.length, 1);
  const form = await c("PUT", "/api/business", "name=evil", { "Content-Type": "application/x-www-form-urlencoded" });
  assert.strictEqual(form.status, 415);
});

test("signed Stripe webhook upgrades and downgrades the plan", async () => {
  const c = client();
  const s = await c("POST", "/api/signup", { email: "pay@shop.co", password: "password123", agreeToTerms: true });
  assert.strictEqual(s.body.quota.plan, "free");
  const me = await c("GET", "/api/reviews"); // ensure session works
  assert.strictEqual(me.status, 200);

  const stripe = new Stripe("sk_test_dummy");
  const send = async (event, secret = "whsec_dummy") => {
    const payload = JSON.stringify(event);
    const sig = stripe.webhooks.generateTestHeaderString({ payload, secret });
    const res = await fetch(base + "/api/billing/webhook", { method: "POST", headers: { "stripe-signature": sig, "Content-Type": "application/json" }, body: payload });
    return res.status;
  };
  const { open, makeStore } = require("../lib/db");
  const userId = (await makeStore(open(process.env.DB_FILE)).userByEmail("pay@shop.co")).id;

  assert.strictEqual(await send({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: String(userId), customer: "cus_1" } } }, "whsec_wrong"), 400);
  assert.strictEqual(await send({ type: "checkout.session.completed", data: { object: { mode: "subscription", client_reference_id: String(userId), customer: "cus_1" } } }), 200);
  let after = await c("GET", "/api/me");
  assert.strictEqual(after.body.quota.plan, "pro");
  assert.strictEqual(after.body.quota.limit, 300);
  assert.strictEqual(after.body.hasSubscription, true);

  assert.strictEqual(await send({ type: "customer.subscription.deleted", data: { object: { customer: "cus_1", status: "canceled" } } }), 200);
  after = await c("GET", "/api/me");
  assert.strictEqual(after.body.quota.plan, "free");
});

test("landing demo is rate limited", async () => {
  const c = client();
  for (let i = 0; i < 3; i++) {
    const r = await c("POST", "/api/demo-reply", { rating: 2, reviewer: "Sam", body: "Slow service", businessName: "Cafe" });
    assert.strictEqual(r.status, 200);
  }
  assert.strictEqual((await c("POST", "/api/demo-reply", { rating: 2, body: "x" })).status, 429);
});

test("signup requires agreeing to the terms, and records it", async () => {
  const c = client();
  const r = await c("POST", "/api/signup", { email: "noconsent@shop.co", password: "password123" });
  assert.strictEqual(r.status, 400);
  assert.match(r.body.error, /Terms of Service/);
  await c("POST", "/api/signup", { email: "consent@shop.co", password: "password123", agreeToTerms: true });
  const data = (await c("GET", "/api/account/export")).body;
  assert.strictEqual(data.account.terms_version, "2026-10-01");
  assert.ok(data.account.terms_accepted_at > 0);
});

test("legal pages render with company details and security headers", async () => {
  for (const p of ["/terms", "/privacy", "/refunds", "/", "/app"]) {
    const res = await fetch(base + p);
    const html = await res.text();
    assert.strictEqual(res.status, 200, p);
    assert.ok(!/\{\{\w+\}\}/.test(html), `unfilled placeholder on ${p}`);
    assert.match(html, /ReplyDesk/);
    assert.match(res.headers.get("content-security-policy"), /frame-ancestors 'none'/);
    assert.strictEqual(res.headers.get("x-content-type-options"), "nosniff");
  }
  const terms = await (await fetch(base + "/terms")).text();
  assert.match(terms, /Renews automatically every month|renews automatically every month/i);
  assert.match(terms, /support@example\.com/);
});

test("users can export and permanently delete their data", async () => {
  const c = client();
  await c("POST", "/api/signup", { email: "leaver@shop.co", password: "password123", agreeToTerms: true });
  await c("POST", "/api/reviews", { rating: 4, reviewer: "Al", body: "Nice place" });
  const exp = await fetch(base + "/api/account/export", { headers: { cookie: "" } });
  assert.strictEqual(exp.status, 401);
  const data = (await c("GET", "/api/account/export")).body;
  assert.strictEqual(data.account.email, "leaver@shop.co");
  assert.strictEqual(data.reviews.length, 1);

  assert.strictEqual((await c("POST", "/api/account/delete", { password: "wrongpass1" })).status, 401);
  assert.strictEqual((await c("POST", "/api/account/delete", { password: "password123" })).status, 200);
  assert.strictEqual((await c("GET", "/api/me")).status, 401);
  const relog = await client()("POST", "/api/login", { email: "leaver@shop.co", password: "password123" });
  assert.strictEqual(relog.status, 401);
});

test("visits are counted by source, and only the owner sees the numbers", async () => {
  const browser = { "user-agent": "Mozilla/5.0 (iPhone; CPU iPhone OS 18_0 like Mac OS X) Safari/604.1" };
  const home = await fetch(base + "/?ref=email", { headers: browser });
  assert.match(await home.text(), /<body data-src="email">/);
  await fetch(base + "/app?ref=email", { headers: browser });
  const ig = await fetch(base + "/", { headers: { ...browser, referer: "https://l.instagram.com/?u=x" } });
  assert.match(await ig.text(), /<body data-src="instagram">/);
  await fetch(base + "/", { headers: { ...browser, referer: base + "/app" } }); // a click from our own page: not a new visit
  await fetch(base + "/?ref=email"); // no browser user agent: a script, not a visitor
  await fetch(base + "/style.css?ref=email", { headers: browser }); // only pages count

  const visitor = client();
  const joined = await visitor("POST", "/api/signup", { email: "new@shop.co", password: "password123", agreeToTerms: true, ref: "email" });
  assert.strictEqual(joined.status, 201);
  assert.strictEqual(joined.body.owner, false);
  assert.strictEqual((await visitor("GET", "/api/owner/stats")).status, 404);
  assert.strictEqual((await client()("GET", "/api/owner/stats")).status, 401);

  const boss = client();
  assert.strictEqual((await boss("POST", "/api/signup", { email: "Boss@shop.co", password: "password123", agreeToTerms: true })).body.owner, true);
  // The owner looking at their own site while logged in is not a visit.
  const login = await fetch(base + "/api/login", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ email: "boss@shop.co", password: "password123" }) });
  await fetch(base + "/?ref=email", { headers: { ...browser, cookie: login.headers.get("set-cookie").split(";")[0] } });

  await new Promise((r) => setTimeout(r, 100)); // counts are written in the background
  const stats = (await boss("GET", "/api/owner/stats")).body;
  const from = Object.fromEntries(stats.sources.map((x) => [x.source, x]));
  assert.deepStrictEqual(from.email, { source: "email", home: 1, app: 1, demo: 0, signup: 1 });
  assert.deepStrictEqual(from.instagram, { source: "instagram", home: 1, app: 0, demo: 0, signup: 0 });
  assert.ok(from.direct.demo >= 1, "demo replies from the earlier test are counted");
  assert.strictEqual(stats.days.length, 14);
  assert.strictEqual(stats.days[0].home, 2);
  assert.strictEqual(stats.accounts.find((a) => a.email === "new@shop.co").source, "email");
  assert.strictEqual(stats.totals.accounts, stats.accounts.length);
  assert.strictEqual((await fetch(base + "/owner")).status, 200);
});

test("the owner can hand out a one-time password reset link", async () => {
  const forgetful = client();
  await forgetful("POST", "/api/signup", { email: "forgot@shop.co", password: "oldpassword1", agreeToTerms: true });
  // Only the owner can create a link.
  assert.strictEqual((await forgetful("POST", "/api/owner/reset-link", { email: "forgot@shop.co" })).status, 404);
  assert.strictEqual((await client()("POST", "/api/owner/reset-link", { email: "forgot@shop.co" })).status, 401);

  const boss = client();
  assert.strictEqual((await boss("POST", "/api/login", { email: "boss@shop.co", password: "password123" })).status, 200);
  assert.strictEqual((await boss("POST", "/api/owner/reset-link", { email: "nobody@shop.co" })).status, 404);
  const first = await boss("POST", "/api/owner/reset-link", { email: "Forgot@shop.co" });
  assert.strictEqual(first.status, 200);
  assert.match(first.body.url, /\/reset#[\w-]{40,}$/);
  // A newer link replaces the older one.
  const second = await boss("POST", "/api/owner/reset-link", { email: "forgot@shop.co" });
  const token = (u) => u.split("#")[1];

  const visitor = client();
  assert.strictEqual((await visitor("POST", "/api/reset-password", { token: "made-up", password: "newpassword1" })).status, 400);
  assert.strictEqual((await visitor("POST", "/api/reset-password", { token: token(first.body.url), password: "newpassword1" })).status, 400);
  assert.strictEqual((await visitor("POST", "/api/reset-password", { token: token(second.body.url), password: "short" })).status, 400);
  const done = await visitor("POST", "/api/reset-password", { token: token(second.body.url), password: "newpassword1" });
  assert.strictEqual(done.status, 200);
  assert.strictEqual(done.body.email, "forgot@shop.co");
  assert.strictEqual((await visitor("GET", "/api/me")).status, 200, "the reset logs them in");

  // The link works once, the old password is dead, and other devices are logged out.
  assert.strictEqual((await client()("POST", "/api/reset-password", { token: token(second.body.url), password: "another12345" })).status, 400);
  assert.strictEqual((await client()("POST", "/api/login", { email: "forgot@shop.co", password: "oldpassword1" })).status, 401);
  assert.strictEqual((await client()("POST", "/api/login", { email: "forgot@shop.co", password: "newpassword1" })).status, 200);
  assert.strictEqual((await forgetful("GET", "/api/me")).status, 401);
  assert.strictEqual((await fetch(base + "/reset")).status, 200);
});
