"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Minus, GraduationCap } from "lucide-react";
import { apiSend, ApiClientError, errorMessage } from "@/lib/client/api";
import { usePricing, useViewer } from "@/lib/client/hooks";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/nav/PageHeader";
import { SignInSheet } from "@/components/profile/SignInSheet";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";

// Plain comparison, no countdowns or fake discounts.
const ROWS: { feature: string; free: string | boolean; lifetime: string | boolean }[] = [
  { feature: "Live incident map and feed", free: true, lifetime: true },
  { feature: "Report and confirm incidents", free: true, lifetime: true },
  { feature: "Alert radius", free: "5 mi", lifetime: "25 mi" },
  { feature: "Saved places", free: "1", lifetime: "10" },
  { feature: "Per-place alert rules", free: false, lifetime: true },
  { feature: "Area insights", free: "7 days", lifetime: "30 days" },
  { feature: "Incident history", free: "24 h", lifetime: "90 days" },
  { feature: "Advanced filters", free: false, lifetime: true },
  { feature: "Quiet hours", free: false, lifetime: true },
  { feature: "Future premium features", free: false, lifetime: true },
];

export function UpgradeScreen() {
  const { viewer } = useViewer();
  const { pricing } = usePricing();
  const toast = useToast();
  const canceled = useSearchParams().get("canceled") === "1";
  const [busy, setBusy] = useState(false);
  const [signIn, setSignIn] = useState(false);

  async function checkout() {
    if (!viewer?.email) {
      setSignIn(true);
      return;
    }
    setBusy(true);
    try {
      const { url } = await apiSend<{ url: string }>("/api/billing/checkout", "POST");
      window.location.assign(url);
    } catch (err) {
      if (err instanceof ApiClientError && err.code === "email_required") setSignIn(true);
      else toast(errorMessage(err), "error");
      setBusy(false);
    }
  }

  const owned = viewer?.plan === "lifetime";

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title="Haven Lifetime" back />
      <div className="mx-auto max-w-lg px-5">
        <div className="relative haven-rise pt-8 text-center">
          <div
            className="pointer-events-none absolute -inset-x-5 -top-24 h-[460px] overflow-hidden"
            style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)" }}
            aria-hidden
          >
            <div className="absolute left-[20%] top-[10%] size-72 rounded-full bg-gold/25 blur-3xl" />
            <div className="absolute right-[10%] top-[30%] size-64 rounded-full bg-brand/15 blur-3xl" />
            
          </div>
          <p className="relative text-[13px] font-semibold uppercase tracking-[0.14em] text-gold">Lifetime</p>
          <h2 className="relative mt-3 text-[40px] font-bold leading-[1.02] tracking-[-0.04em]">
            Pay once.
            <br />
            Never again.
          </h2>
          <p className="mx-auto mt-3 max-w-[300px] text-[15.5px] leading-relaxed text-muted">
            The core of Haven is free. Lifetime unlocks everything else, permanently, with no subscription.
          </p>
          <div className="relative mt-8">
            {pricing ? (
              <p className="text-[64px] font-bold leading-none tracking-[-0.05em] tnum">
                {pricing.formatted}
                <span className="ml-2 align-middle text-[15px] font-medium tracking-normal text-muted">once</span>
              </p>
            ) : (
              <Skeleton className="mx-auto h-12 w-36" />
            )}
          </div>
          {pricing?.student && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-[13px] font-semibold text-brand">
              <GraduationCap className="size-4" aria-hidden />
              Student price · {pricing.student.percentOff}% off{" "}
              <span className="font-normal text-muted line-through">{pricing.student.fullFormatted}</span>
            </p>
          )}
          {pricing && !pricing.student && !owned && (
            <p className="mx-auto mt-3 flex max-w-[300px] items-start justify-center gap-2 text-[13px] leading-snug text-muted">
              <GraduationCap className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>
                Student? Sign in with your <span className="font-semibold text-text">.edu</span> email and it&apos;s{" "}
                <span className="font-semibold text-text">{pricing.studentFormatted}</span>.
              </span>
            </p>
          )}
          {pricing?.mode === "test" && <p className="mt-3 text-[12.5px] text-faint">Test mode · no real payment is taken</p>}
        </div>

        {canceled && !owned && <p className="mt-5 text-center text-[14px] text-muted">Checkout canceled. You weren&apos;t charged.</p>}

        <div className="mt-8">
          {owned ? (
            <div className="rounded-2xl bg-ok/10 px-4 py-4 text-center text-[15px] font-medium text-ok">You own Haven Lifetime. Thank you.</div>
          ) : (
            <Button variant="gold" size="lg" block onClick={checkout} loading={busy} disabled={!pricing || !viewer}>
              {pricing ? `Unlock for ${pricing.formatted}` : "Unlock Lifetime"}
            </Button>
          )}
          {!owned && (
            <p className="mt-3 text-center text-[13px] leading-relaxed text-faint">
              Charged once. Nothing renews, so there&apos;s nothing to cancel.
              {!viewer?.email && " You'll verify your email first so the purchase follows you to any device."}
            </p>
          )}
        </div>

        <table className="mt-9 w-full border-collapse text-[14.5px]">
          <thead>
            <tr className="text-[12.5px] font-medium text-muted">
              <th className="pb-3 text-left font-medium">What you get</th>
              <th className="w-[72px] pb-3 text-center font-medium">Free</th>
              <th className="w-[72px] pb-3 text-center font-medium text-gold">Lifetime</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <td className="py-3.5 pr-3 tracking-[-0.01em]">{r.feature}</td>
                <Cell v={r.free} />
                <Cell v={r.lifetime} gold />
              </tr>
            ))}
          </tbody>
        </table>

        {owned && (
          <ButtonLink href="/" variant="secondary" block className="mt-8">
            Back to map
          </ButtonLink>
        )}
      </div>
      <SignInSheet open={signIn} onClose={() => setSignIn(false)} reason="Verify your email so your Lifetime purchase is tied to you, not just this device." />
    </main>
  );
}

function Cell({ v, gold }: { v: string | boolean; gold?: boolean }) {
  return (
    <td className={`py-3.5 text-center tnum ${gold ? "text-text" : "text-muted"}`}>
      {v === true ? (
        <Check className={`mx-auto size-[18px] ${gold ? "text-gold" : "text-muted"}`} strokeWidth={2.4} aria-label="Included" />
      ) : v === false ? (
        <Minus className="mx-auto size-4 text-faint" aria-label="Not included" />
      ) : (
        v
      )}
    </td>
  );
}
