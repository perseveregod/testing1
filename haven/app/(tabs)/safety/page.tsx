import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { SafetyScreen } from "@/components/safety/SafetyScreen";

export const metadata: Metadata = { title: "Safety" };

// Static shell: switching to this tab is instant, and the briefing fills in
// from the client's cache (the map has usually fetched these incidents already).
export default function SafetyPage() {
  return (
    <PageTransition>
      <SafetyScreen />
    </PageTransition>
  );
}
