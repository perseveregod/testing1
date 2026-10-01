"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
import { apiSend } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
import type { Viewer } from "@/lib/types";
import { ButtonLink } from "@/components/ui/Button";
import { Spinner } from "@/components/ui/States";

export function PurchaseSuccess() {
  const sessionId = useSearchParams().get("session_id");
  const { viewer, mutate } = useViewer();
  const [checking, setChecking] = useState(Boolean(sessionId));

  // After Stripe redirects back, confirm directly so the unlock is instant
  // even if the webhook is still on its way.
  useEffect(() => {
    if (!sessionId) return;
    apiSend<{ viewer: Viewer }>("/api/billing/confirm", "POST", { sessionId })
      .then((r) => mutate({ viewer: r.viewer }, { revalidate: false }))
      .catch(() => mutate())
      .finally(() => setChecking(false));
  }, [sessionId, mutate]);

  const unlocked = viewer?.plan === "lifetime";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center" style={{ paddingBottom: "var(--safe-bottom)" }}>
      {checking || !viewer ? (
        <>
          <Spinner className="size-8 text-gold" />
          <p className="mt-4 text-muted">Confirming your purchase…</p>
        </>
      ) : unlocked ? (
        <>
          <span className="haven-pop flex size-[72px] items-center justify-center rounded-full bg-gold/15">
            <Crown className="size-8 text-gold" aria-hidden />
          </span>
          <h1 className="haven-rise mt-6 text-[28px] font-bold tracking-[-0.03em]">Lifetime unlocked</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            Larger alert radius, more saved places, per-place rules, area insights, advanced filters and 90-day history are on. You&apos;ll never be billed again.
          </p>
        </>
      ) : (
        <>
          <h1 className="text-[22px] font-bold">Payment received</h1>
          <p className="mt-2 text-[15px] text-muted">
            Your unlock is being finalized. It usually takes a few seconds; refresh this page if it doesn&apos;t appear.
          </p>
        </>
      )}
      <div className="mt-8 w-full space-y-2">
        <ButtonLink href="/alerts" block size="lg" variant={unlocked ? "gold" : "primary"}>
          Set up alerts
        </ButtonLink>
        <ButtonLink href="/" block size="lg" variant="secondary">
          Back to map
        </ButtonLink>
      </div>
    </main>
  );
}
