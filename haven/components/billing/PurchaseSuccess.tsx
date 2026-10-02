"use client";

import { useEffect, useState } from "react";
import { useSearchParams } from "next/navigation";
import { Crown } from "lucide-react";
import { apiSend } from "@/lib/client/api";
import { usePricing, useViewer } from "@/lib/client/hooks";
import { FEATURES } from "@/lib/features";
import { useT } from "@/lib/client/lang";
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
  const { es } = useT();
  const { pricing } = usePricing();
  const test = pricing?.mode === "test";

  return (
    <main className="mx-auto flex min-h-dvh max-w-lg flex-col items-center justify-center px-6 text-center" style={{ paddingBottom: "var(--safe-bottom)" }}>
      {checking || !viewer ? (
        <>
          <Spinner className="size-8 text-gold" />
          <p className="mt-4 text-muted">{es ? "Confirmando su compra…" : "Confirming your purchase…"}</p>
        </>
      ) : unlocked ? (
        <>
          <span className="haven-pop flex size-[72px] items-center justify-center rounded-full bg-gold/15">
            <Crown className="size-8 text-gold" aria-hidden />
          </span>
          <h1 className="haven-rise mt-6 text-[28px] font-bold tracking-[-0.03em]">{es ? "De por vida desbloqueado" : "Lifetime unlocked"}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {es
              ? `Radio de alerta más amplio, más lugares guardados, reglas por lugar${FEATURES.insights ? ", tendencias de la zona" : ""}, filtros avanzados e historial de hasta 30 días ya están activos. No hay renovaciones.`
              : `Larger alert radius, more saved places, per-place rules${FEATURES.insights ? ", area insights" : ""}, advanced filters and up to 30 days of history are on. There are no renewals.`}
          </p>
          {test && (
            <p className="mt-3 rounded-card bg-warn/10 px-4 py-2.5 text-[13px] font-medium text-warn">
              {es ? "Compra de prueba · no se cobró nada real" : "Test purchase · no real payment was taken"}
            </p>
          )}
        </>
      ) : (
        <>
          {/* Nothing here has confirmed a payment, so the page doesn't claim one. */}
          <h1 className="text-[22px] font-bold">{es ? "Aún no se confirma ningún pago" : "No payment confirmed yet"}</h1>
          <p className="mt-2 text-[15px] leading-relaxed text-muted">
            {sessionId
              ? es
                ? "Haven no pudo confirmar un pago para esta cuenta. Si completó el pago, el desbloqueo suele aparecer en un minuto: actualice esta página. Nada se desbloquea hasta que el pago se confirme."
                : "Haven couldn't confirm a payment for this account. If you completed checkout, the unlock usually appears within a minute: refresh this page. Nothing is unlocked until the payment is confirmed."
              : es
                ? "Esta cuenta no tiene De por vida y no hay ninguna compra en curso."
                : "This account doesn't have Lifetime and there's no purchase in progress."}
          </p>
        </>
      )}
      <div className="mt-8 w-full space-y-2">
        <ButtonLink href="/alerts" block size="lg" variant={unlocked ? "gold" : "primary"}>
          {es ? "Configurar alertas" : "Set up alerts"}
        </ButtonLink>
        <ButtonLink href="/" block size="lg" variant="secondary">
          {es ? "Volver al mapa" : "Back to map"}
        </ButtonLink>
      </div>
    </main>
  );
}
