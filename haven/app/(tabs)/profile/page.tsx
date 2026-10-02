import { PageTransition } from "@/components/nav/PageTransition";
import type { Metadata } from "next";
import { ProfileScreen } from "@/components/profile/ProfileScreen";

export const metadata: Metadata = { title: "Profile" };

export default function ProfilePage() {
  return <PageTransition>
      <ProfileScreen />
    </PageTransition>;
}
