import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { Suspense } from "react";
import { UpgradeScreen } from "@/components/billing/UpgradeScreen";

export const metadata: Metadata = { title: "Lifetime" };

export default function UpgradePage() {
  return (
    <PageTransition push>
      <Suspense>
        <UpgradeScreen />
      </Suspense>
    </PageTransition>
  );
}
