import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { EventDetailScreen } from "@/components/community/EventDetailScreen";

export const metadata: Metadata = { title: "Event" };

export default async function CommunityEventPage(props: PageProps<"/community/[id]">) {
  const { id } = await props.params;
  return (
    <PageTransition push>
      <EventDetailScreen id={id} />
    </PageTransition>
  );
}
