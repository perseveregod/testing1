import Stripe from "stripe";
import { beforeAll, describe, expect, it, vi } from "vitest";
import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";

const WH = "whsec_test_secret";

describe("Stripe webhook", () => {
  let store: LocalStore;
  let handleWebhook: typeof import("@/server/billing").handleWebhook;

  beforeAll(async () => {
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_test_dummy");
    vi.stubEnv("STRIPE_WEBHOOK_SECRET", WH);
    ({ handleWebhook } = await import("@/server/billing"));
    store = new LocalStore(null);
    setStoreForTests(store);
  });

  const signed = (event: object) => {
    const payload = JSON.stringify(event);
    return { payload, sig: Stripe.webhooks.generateTestHeaderString({ payload, secret: WH }) };
  };
  const completed = (userId: string, id = "cs_test_1") => ({
    id: "evt_1",
    type: "checkout.session.completed",
    data: { object: { id, object: "checkout.session", mode: "payment", payment_status: "paid", metadata: { userId }, amount_total: 1999, currency: "usd" } },
  });

  it("rejects bad signatures", async () => {
    const { payload } = signed(completed("x"));
    await expect(handleWebhook(payload, "t=1,v1=bad")).rejects.toMatchObject({ status: 400 });
  });

  it("grants a permanent entitlement once, idempotently", async () => {
    const u = await store.createUser({ email: "a@b.co", displayName: "a" });
    const { payload, sig } = signed(completed(u.id));
    await handleWebhook(payload, sig);
    await handleWebhook(payload, sig);
    const ent = await store.getEntitlement(u.id);
    expect(ent).toMatchObject({ plan: "lifetime", source: "stripe", externalRef: "cs_test_1", amountCents: 1999 });
  });

  it("ignores unpaid sessions", async () => {
    const u = await store.createUser({ email: "c@d.co", displayName: "c" });
    const ev = completed(u.id, "cs_test_2");
    (ev.data.object as Record<string, unknown>).payment_status = "unpaid";
    const { payload, sig } = signed(ev);
    await handleWebhook(payload, sig);
    expect(await store.getEntitlement(u.id)).toBeNull();
  });
});

describe("what the upgrade page is allowed to claim", () => {
  const mode = async (envs: Record<string, string>) => {
    vi.unstubAllEnvs();
    for (const [k, v] of Object.entries(envs)) vi.stubEnv(k, v);
    const { config } = await import("@/server/config");
    return config.billing.mode;
  };

  it("is test mode with a Stripe test key: nothing real is charged", async () => {
    expect(await mode({ STRIPE_SECRET_KEY: "sk_test_abc" })).toBe("test");
  });

  it("a live key alone never starts real charges", async () => {
    expect(await mode({ STRIPE_SECRET_KEY: "sk_live_abc" })).toBe("unavailable");
    expect(await mode({ STRIPE_SECRET_KEY: "rk_live_abc", HAVEN_BILLING_LIVE: "0" })).toBe("unavailable");
  });

  it("goes live only with a live key and the owner's confirmation", async () => {
    expect(await mode({ STRIPE_SECRET_KEY: "sk_live_abc", HAVEN_BILLING_LIVE: "1" })).toBe("live");
  });

  it("the confirmation flag does nothing with a test key or no key", async () => {
    expect(await mode({ STRIPE_SECRET_KEY: "sk_test_abc", HAVEN_BILLING_LIVE: "1" })).toBe("test");
    expect(await mode({ HAVEN_BILLING_LIVE: "1" })).not.toBe("live");
  });

  it("refuses checkout while purchases aren't open", async () => {
    vi.unstubAllEnvs();
    vi.stubEnv("STRIPE_SECRET_KEY", "sk_live_abc");
    const { createCheckout } = await import("@/server/billing");
    const store = new LocalStore(null);
    setStoreForTests(store);
    const u = await store.createUser({ email: "buyer@example.com", displayName: "b" });
    await expect(createCheckout(u, "http://localhost")).rejects.toMatchObject({ status: 503, code: "billing_unavailable" });
    vi.unstubAllEnvs();
  });
});
