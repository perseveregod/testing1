import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { CommunityScreen } from "@/components/community/CommunityScreen";

export const metadata: Metadata = { title: "Community" };

export default function CommunityPage() {
  return (
    <PageTransition>
      <CommunityScreen />
    </PageTransition>
  );
}
