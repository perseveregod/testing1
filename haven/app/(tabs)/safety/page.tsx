import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { SafetyScreen } from "@/components/safety/SafetyScreen";
import { initialIncidents } from "@/server/services/initial";

export const metadata: Metadata = { title: "Safety" };
export const dynamic = "force-dynamic";

export default async function SafetyPage() {
  const initial = await initialIncidents(10, 100);
  return (
    <PageTransition>
      <SafetyScreen initial={initial} />
    </PageTransition>
  );
}
