"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { CreditCard, FlaskConical } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useToast } from "@/components/providers/ToastProvider";
import { Button, ButtonLink } from "@/components/ui/Button";

export function TestCheckout({ formatted }: { formatted: string }) {
  const router = useRouter();
  const toast = useToast();
  const [busy, setBusy] = useState(false);

  async function pay() {
    setBusy(true);
    try {
      await apiSend("/api/billing/test-complete", "POST");
      router.replace("/billing/success");
    } catch (err) {
      toast(errorMessage(err), "error");
      setBusy(false);
    }
  }

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col px-4" style={{ paddingTop: "calc(var(--safe-top) + 24px)", paddingBottom: "calc(var(--safe-bottom) + 24px)" }}>
      <div className="flex items-center gap-2 rounded-2xl bg-warn/10 px-4 py-3 text-[14px] font-medium text-warn">
        <FlaskConical className="size-5 shrink-0" aria-hidden />
        TEST CHECKOUT: no real payment. Configure Stripe to take real payments.
      </div>
      <div className="mt-6 rounded-card bg-surface p-5">
        <p className="text-[13px] text-muted">Order summary</p>
        <div className="mt-2 flex items-baseline justify-between">
          <p className="text-[17px] font-semibold">Haven Lifetime</p>
          <p className="text-[17px] font-semibold">{formatted}</p>
        </div>
        <p className="mt-1 text-[13px] text-muted">One-time payment · no subscription</p>
        <div className="mt-5 flex items-center gap-3 rounded-2xl bg-surface-2 px-4 py-3 text-[14px] text-muted">
          <CreditCard className="size-5" aria-hidden /> Test card •••• 4242
        </div>
      </div>
      <div className="mt-auto space-y-2 pt-6">
        <Button variant="gold" size="lg" block onClick={pay} loading={busy}>
          Complete test purchase
        </Button>
        <ButtonLink href="/upgrade?canceled=1" variant="ghost" size="lg" block>
          Cancel
        </ButtonLink>
      </div>
    </main>
  );
}
