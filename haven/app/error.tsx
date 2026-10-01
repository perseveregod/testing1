"use client";

import { useEffect } from "react";
import { ErrorState } from "@/components/ui/States";

export default function Error({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error(error);
  }, [error]);
  return (
    <main className="flex min-h-dvh items-center justify-center pt-safe pb-safe">
      <ErrorState message="Something went wrong on this screen." onRetry={reset} />
    </main>
  );
}
