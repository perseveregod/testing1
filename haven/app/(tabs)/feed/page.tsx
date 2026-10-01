import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { FeedScreen } from "@/components/feed/FeedScreen";

export const metadata: Metadata = { title: "Feed" };

export default function FeedPage() {
  return <PageTransition>
      <FeedScreen />
    </PageTransition>;
}
