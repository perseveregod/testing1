import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { SafetyScreen } from "@/components/safety/SafetyScreen";

export const metadata: Metadata = { title: "Safety" };

export default function SafetyPage() {
  return (
    <PageTransition>
      <SafetyScreen />
    </PageTransition>
  );
}
