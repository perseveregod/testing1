import { json, route } from "@/server/http";
import { handleWebhook } from "@/server/billing";

// Stripe → POST here. Configure the endpoint for checkout.session.completed
// and checkout.session.async_payment_succeeded; set STRIPE_WEBHOOK_SECRET.
export const POST = route(async (req: Request) => {
  const raw = await req.text();
  return json(await handleWebhook(raw, req.headers.get("stripe-signature")));
});
