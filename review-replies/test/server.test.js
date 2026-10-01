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
const Stripe = require("stripe");
const { server } = require("../server");

let base;
test.before(() => new Promise((r) => server.listen(0, () => { base = `http://localhost:${server.address().port}`; r(); })));
test.after(() => { server.close(); fs.rmSync(dir, { recursive: true, force: true }); });

function client() {
  let cookie = "";
  return async (method, p, body, headers = {}) => {
    const res = await fetch(base + p, {
      method,
      headers: { ...(body !== undefined ? { "Content-Type": "application/json" } : {}), ...(cookie ? { cookie } : {}), ...headers },
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
  const signup = await c("POST", "/api/signup", { email: "owner@shop.co", password: "password123" });
  assert.strictEqual(signup.status, 201);
  assert.strictEqual(signup.body.quota.limit, 15);
  assert.strictEqual((await c("POST", "/api/signup", { email: "OWNER@shop.co", password: "password123" })).status, 409);

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
  await other("POST", "/api/signup", { email: "other@shop.co", password: "password123" });
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
  const login = await c("POST", "/api/login", { email: "owner@shop.co", password: "password123" });
  assert.strictEqual(login.status, 200);
  assert.strictEqual((await c("POST", "/api/login", { email: "owner@shop.co", password: "nope12345" })).status, 401);
});

test("CSV import and CSRF protection", async () => {
  const c = client();
  await c("POST", "/api/signup", { email: "csv@shop.co", password: "password123" });
  const r = await c("POST", "/api/reviews", { csv: "rating,reviewer,review\n4,Al,Nice\n9,Bo,Bad rating\n" });
  assert.strictEqual(r.body.added, 1);
  assert.strictEqual(r.body.skipped.length, 1);
  const form = await c("PUT", "/api/business", "name=evil", { "Content-Type": "application/x-www-form-urlencoded" });
  assert.strictEqual(form.status, 415);
});

test("signed Stripe webhook upgrades and downgrades the plan", async () => {
  const c = client();
  const s = await c("POST", "/api/signup", { email: "pay@shop.co", password: "password123" });
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
  const userId = makeStore(open(process.env.DB_FILE)).userByEmail("pay@shop.co").id;

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
