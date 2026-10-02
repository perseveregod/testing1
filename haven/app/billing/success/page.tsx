import type { Metadata } from "next";
import { Suspense } from "react";
import { PurchaseSuccess } from "@/components/billing/PurchaseSuccess";

export const metadata: Metadata = { title: "Thank you", robots: { index: false } };

export default function SuccessPage() {
  return (
    <Suspense>
      <PurchaseSuccess />
    </Suspense>
  );
}
