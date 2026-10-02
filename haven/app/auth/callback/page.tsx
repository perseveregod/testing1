import { Spinner } from "@/components/ui/States";

export const metadata = { title: "Signing in" };

// The sign-in itself happens in EmailLinkHandler (mounted app-wide), which
// reads the token from the URL fragment. This page is just what shows meanwhile.
export default function AuthCallbackPage() {
  return (
    <main className="flex min-h-dvh flex-col items-center justify-center gap-4 pt-safe pb-safe text-muted">
      <Spinner className="size-7" />
      <p className="text-[15px]">Signing you in…</p>
    </main>
  );
}
