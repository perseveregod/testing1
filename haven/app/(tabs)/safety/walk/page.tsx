import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { SafeWalkScreen } from "@/components/safety/SafeWalkScreen";

export const metadata: Metadata = { title: "Safe Walk" };

export default function SafeWalkPage() {
  return (
    <PageTransition>
      <SafeWalkScreen />
    </PageTransition>
  );
}
