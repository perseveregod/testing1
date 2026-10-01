import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { ReportFlow } from "@/components/report/ReportFlow";

export const metadata: Metadata = { title: "Report" };

export default function ReportPage() {
  return <PageTransition push>
      <ReportFlow />
    </PageTransition>;
}
