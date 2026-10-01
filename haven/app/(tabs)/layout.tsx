import { BottomNav } from "@/components/nav/BottomNav";
import { WelcomeFlow } from "@/components/onboarding/WelcomeFlow";

export default function TabsLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      {children}
      <BottomNav />
      <WelcomeFlow />
    </>
  );
}
