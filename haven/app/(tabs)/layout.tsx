import { BottomNav } from "@/components/nav/BottomNav";
import { MapHost } from "@/components/map/MapHost";
import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";

// Every tab is static: no server round-trip on a tab tap. The map is mounted
// once here and stays alive under the other tabs; incidents load from the
// client cache, which the map warms on first open.
export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <MapHost />
      {children}
      <BottomNav />
      <WelcomeFlow />
    </>
  );
}
