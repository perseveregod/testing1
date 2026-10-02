import Stripe from "stripe";
import type { PricingInfo } from "@/lib/types";
import { config } from "../config";
import { ApiError } from "../http";
import { getStore } from "../store";
import type { UserRecord } from "../store/types";

// One-time "Lifetime" purchase. There is no subscription code path anywhere:
// Checkout runs in `payment` mode and a successful payment writes a single
// permanent entitlement row. The price is configuration (env or a Stripe
// Price id), so changing it never requires a code change.

let stripe: Stripe | null = null;
function stripeClient(): Stripe | null {
  if (!config.billing.stripeSecretKey) return null;
  stripe ??= new Stripe(config.billing.stripeSecretKey);
  return stripe;
}

const priceCache: { at: number; value: PricingInfo | null } = { at: 0, value: null };

function format(amountCents: number, currency: string) {
  return new Intl.NumberFormat("en-US", { style: "currency", currency: currency.toUpperCase() }).format(
    amountCents / 100,
  );
}

/** A verified .edu address (emails only reach the account after code sign-in). */
export function isStudentEmail(email: string | null | undefined): boolean {
  return Boolean(email && /@([a-z0-9-]+\.)+edu$/i.test(email.trim()));
}

/** Pricing for this person: students with a verified .edu email get the student price. */
export async function getPricing(user?: Pick<UserRecord, "email"> | null): Promise<PricingInfo> {
  const base = await getBasePricing();
  if (!isStudentEmail(user?.email)) return base;
  const amountCents = Math.min(config.billing.studentAmountCents, base.amountCents);
  return {
    ...base,
    amountCents,
    formatted: format(amountCents, base.currency),
    student: {
      fullFormatted: base.formatted,
      percentOff: Math.round((1 - amountCents / base.amountCents) * 100),
    },
  };
}

async function getBasePricing(): Promise<PricingInfo> {
  if (priceCache.value && Date.now() - priceCache.at < 10 * 60_000) return priceCache.value;
  let amountCents = config.billing.lifetimeAmountCents;
  let currency = config.billing.currency;
  const s = stripeClient();
  if (s && config.billing.stripePriceId) {
    const price = await s.prices.retrieve(config.billing.stripePriceId);
    if (price.type !== "one_time") {
      throw new Error("STRIPE_LIFETIME_PRICE_ID must be a one-time price, not a recurring one.");
    }
    amountCents = price.unit_amount ?? amountCents;
    currency = price.currency;
  }
  const value: PricingInfo = {
    planId: "lifetime",
    name: "Haven Lifetime",
    amountCents,
    currency,
    formatted: format(amountCents, currency),
    mode: config.billing.mode,
    student: null,
    studentFormatted: format(Math.min(config.billing.studentAmountCents, amountCents), currency),
  };
  priceCache.value = value;
  priceCache.at = Date.now();
  return value;
}

/** `origin` is used for redirect URLs when NEXT_PUBLIC_APP_URL isn't set. */
export async function createCheckout(user: UserRecord, origin: string): Promise<{ url: string }> {
  if (!user.email) {
    throw new ApiError(400, "Verify your email first so your purchase follows you to any device.", "email_required");
  }
  const existing = await getStore().getEntitlement(user.id);
  if (existing) throw new ApiError(409, "You already have Haven Lifetime.", "already_owned");
  // Includes a live key that hasn't been confirmed yet: no real charges until it is.
  if (config.billing.mode === "unavailable") {
    throw new ApiError(503, "Purchases aren't open yet.", "billing_unavailable");
  }

  const s = stripeClient();
  if (!s) {
    if (!config.billing.testCheckoutEnabled) {
      throw new ApiError(503, "Payments aren't configured yet.", "billing_unavailable");
    }
    return { url: "/billing/test-checkout" };
  }
  const base = config.appUrlConfigured ? config.appUrl : origin;

  const pricing = await getPricing(user);
  // Students pay the student amount, so they always get an inline price.
  const lineItem: Stripe.Checkout.SessionCreateParams.LineItem = config.billing.stripePriceId && !pricing.student
    ? { price: config.billing.stripePriceId, quantity: 1 }
    : {
        quantity: 1,
        price_data: {
          currency: pricing.currency,
          unit_amount: pricing.amountCents,
          product_data: {
            name: pricing.student ? "Haven Lifetime (student)" : "Haven Lifetime",
            description: "One payment. No monthly subscription. Unlocks premium features permanently.",
          },
        },
      };
  const session = await s.checkout.sessions.create({
    mode: "payment",
    line_items: [lineItem],
    customer_email: user.email,
    client_reference_id: user.id,
    metadata: { userId: user.id, plan: "lifetime", student: pricing.student ? "1" : "0" },
    success_url: `${base}/billing/success?session_id={CHECKOUT_SESSION_ID}`,
    cancel_url: `${base}/upgrade?canceled=1`,
  });
  if (!session.url) throw new ApiError(502, "Couldn't start checkout. Try again.", "stripe_error");
  return { url: session.url };
}

/** Grants the entitlement for a paid Checkout Session. Idempotent. */
async function fulfill(session: Stripe.Checkout.Session): Promise<boolean> {
  const userId = session.metadata?.userId || session.client_reference_id;
  if (!userId || session.payment_status !== "paid" || session.mode !== "payment") return false;
  const user = await getStore().getUser(userId);
  if (!user) return false;
  return getStore().grantEntitlement({
    userId,
    plan: "lifetime",
    source: "stripe",
    externalRef: session.id,
    amountCents: session.amount_total ?? 0,
    currency: session.currency ?? config.billing.currency,
    grantedAt: new Date().toISOString(),
  });
}

export async function handleWebhook(rawBody: string, signature: string | null) {
  const s = stripeClient();
  if (!s || !config.billing.stripeWebhookSecret) throw new ApiError(503, "Webhooks not configured", "billing_unavailable");
  if (!signature) throw new ApiError(400, "Missing signature", "bad_signature");
  let event: Stripe.Event;
  try {
    event = s.webhooks.constructEvent(rawBody, signature, config.billing.stripeWebhookSecret);
  } catch {
    throw new ApiError(400, "Invalid signature", "bad_signature");
  }
  if (event.type === "checkout.session.completed" || event.type === "checkout.session.async_payment_succeeded") {
    await fulfill(event.data.object as Stripe.Checkout.Session);
  }
  return { received: true };
}

/**
 * Called from the success page so the unlock shows immediately even if the
 * webhook hasn't arrived yet. Verifies the session with Stripe directly.
 */
export async function confirmCheckout(sessionId: string, user: UserRecord) {
  const s = stripeClient();
  if (!s) return false;
  const session = await s.checkout.sessions.retrieve(sessionId);
  const owner = session.metadata?.userId || session.client_reference_id;
  if (owner !== user.id) throw new ApiError(403, "This purchase belongs to another account.", "forbidden");
  return fulfill(session);
}

/** Development/test checkout: grants Lifetime without charging anything. */
export async function completeTestCheckout(user: UserRecord) {
  if (!config.billing.testCheckoutEnabled) throw new ApiError(404, "Not found", "not_found");
  if (!user.email) throw new ApiError(400, "Verify your email first.", "email_required");
  const pricing = await getPricing(user);
  await getStore().grantEntitlement({
    userId: user.id,
    plan: "lifetime",
    source: "test",
    externalRef: `test_${user.id}`,
    amountCents: pricing.amountCents,
    currency: pricing.currency,
    grantedAt: new Date().toISOString(),
  });
}
