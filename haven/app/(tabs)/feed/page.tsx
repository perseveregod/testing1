import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { FeedScreen } from "@/components/feed/FeedScreen";
import { initialIncidents } from "@/server/services/initial";

export const metadata: Metadata = { title: "Feed" };
export const dynamic = "force-dynamic";

export default async function FeedPage() {
  const initial = await initialIncidents(5, 200);
  return (
    <PageTransition>
      <FeedScreen initial={initial} />
    </PageTransition>
  );
}
