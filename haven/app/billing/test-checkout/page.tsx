import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { TestCheckout } from "@/components/billing/TestCheckout";
import { getPricing } from "@/server/billing";
import { config } from "@/server/config";
import { currentUser } from "@/server/auth/session";

export const metadata: Metadata = { title: "Test checkout", robots: { index: false } };
export const dynamic = "force-dynamic";

/** Sandbox stand-in for Stripe Checkout. Only exists when Stripe isn't configured outside production. */
export default async function TestCheckoutPage() {
  if (!config.billing.testCheckoutEnabled) notFound();
  const pricing = await getPricing(await currentUser());
  return <TestCheckout formatted={pricing.formatted} />;
}
