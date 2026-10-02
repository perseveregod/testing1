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
