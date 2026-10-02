import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { FeedScreen } from "@/components/feed/FeedScreen";

export const metadata: Metadata = { title: "Feed" };

// Static shell: the tab opens instantly and the list fills from the client's
// cache (the map has already fetched the same "near you" query).
export default function FeedPage() {
  return (
    <PageTransition>
      <FeedScreen />
    </PageTransition>
  );
}
