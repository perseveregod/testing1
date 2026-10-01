import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { AlertsScreen } from "@/components/alerts/AlertsScreen";

export const metadata: Metadata = { title: "Alerts" };

export default function AlertsPage() {
  return <PageTransition>
      <AlertsScreen />
    </PageTransition>;
}
