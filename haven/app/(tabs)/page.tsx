import { PageTransition } from "@/components/nav/PageTransition";
import { MapScreen } from "@/components/map/MapScreen";

export default function MapPage() {
  return <PageTransition>
      <MapScreen />
    </PageTransition>;
}
