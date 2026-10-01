import { BottomNav } from "@/components/nav/BottomNav";
import { MapHost } from "@/components/map/MapHost";
import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";
import { initialIncidents } from "@/server/services/initial";

export const dynamic = "force-dynamic";

export default async function TabsLayout({ children }: { children: React.ReactNode }) {
  // The map's first query is the default area at the 5 mi bucket, fetched
  // once here so the map has incidents on its very first paint.
  const initial = await initialIncidents(5, 200);
  return (
    <>
      <MapHost initial={initial} />
      {children}
      <BottomNav />
      <WelcomeFlow />
    </>
  );
}
