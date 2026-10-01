import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { IncidentDetailScreen } from "@/components/incident/IncidentDetailScreen";

export const metadata: Metadata = { title: "Incident" };

export default async function IncidentPage(props: PageProps<"/incidents/[id]">) {
  const { id } = await props.params;
  return <PageTransition>
      <IncidentDetailScreen id={id} />
    </PageTransition>;
}
