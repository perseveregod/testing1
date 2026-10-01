import type { Metadata } from "next";
import { PageTransition } from "@/components/nav/PageTransition";
import { InsightsScreen } from "@/components/insights/InsightsScreen";

export const metadata: Metadata = { title: "Area insights" };

export default function InsightsPage() {
  return (
    <PageTransition>
      <InsightsScreen />
    </PageTransition>
  );
}
