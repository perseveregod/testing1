import { PageTransition } from "@/components/nav/PageTransition";
import { MapScreen } from "@/components/map/MapScreen";
import { initialIncidents } from "@/server/services/initial";

export const dynamic = "force-dynamic";

export default async function MapPage() {
  // The map's first query is the default area at the 5 mi bucket.
  const initial = await initialIncidents(5, 200);
  return (
    <PageTransition>
      <MapScreen initial={initial} />
    </PageTransition>
  );
}
