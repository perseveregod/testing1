"use client";

import { useState } from "react";
import { useSearchParams } from "next/navigation";
import { Check, Minus, GraduationCap } from "lucide-react";
import { apiSend, ApiClientError, errorMessage } from "@/lib/client/api";
import { usePricing, useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/nav/PageHeader";
import { SignInSheet } from "@/components/profile/SignInSheet";
import { Button, ButtonLink } from "@/components/ui/Button";
import { Skeleton } from "@/components/ui/States";

// Plain comparison, no countdowns or fake discounts.
const ROWS: { feature: string; es: string; free: string | boolean; lifetime: string | boolean; freeEs?: string; lifetimeEs?: string }[] = [
  { feature: "Live incident map and feed", es: "Mapa y noticias en vivo", free: true, lifetime: true },
  { feature: "Report and confirm incidents", es: "Reportar y confirmar incidentes", free: true, lifetime: true },
  { feature: "Alert radius", es: "Radio de alerta", free: "5 mi", lifetime: "25 mi" },
  { feature: "Saved places", es: "Lugares guardados", free: "1", lifetime: "10" },
  { feature: "Per-place alert rules", es: "Reglas por lugar", free: false, lifetime: true },
  { feature: "Area insights", es: "Tendencias de la zona", free: "7 days", lifetime: "30 days", freeEs: "7 días", lifetimeEs: "30 días" },
  { feature: "Incident history", es: "Historial de incidentes", free: "24 h", lifetime: "90 days", lifetimeEs: "90 días" },
  { feature: "Advanced filters", es: "Filtros avanzados", free: false, lifetime: true },
  { feature: "Quiet hours", es: "Horas de silencio", free: false, lifetime: true },
  { feature: "Future premium features", es: "Futuras funciones premium", free: false, lifetime: true },
];

export function UpgradeScreen() {
  const { viewer } = useViewer();
  const { pricing } = usePricing();
  const toast = useToast();
  const { es } = useT();
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
      <PageHeader title={es ? "Haven de por vida" : "Haven Lifetime"} back />
      <div className="mx-auto max-w-lg px-5">
        <div className="relative haven-rise pt-8 text-center">
          <div
            className="pointer-events-none absolute -inset-x-5 -top-24 h-[460px] overflow-hidden"
            style={{ maskImage: "linear-gradient(to bottom, black 55%, transparent 100%)", WebkitMaskImage: "linear-gradient(to bottom, black 55%, transparent 100%)" }}
            aria-hidden
          >
            <div className="absolute inset-0" style={{ background: "radial-gradient(70% 60% at 30% 10%, rgba(233,194,122,0.22), transparent 70%), radial-gradient(60% 50% at 85% 40%, rgba(61,139,255,0.14), transparent 70%)" }} />
            
          </div>
          <p className="relative text-[13px] font-semibold text-gold">{es ? "De por vida" : "Lifetime"}</p>
          <h2 className="relative mt-3 text-[40px] font-bold leading-[1.02] tracking-[-0.04em]">
            {es ? "Pague una vez." : "Pay once."}
            <br />
            {es ? "Nunca más." : "Never again."}
          </h2>
          <p className="mx-auto mt-3 max-w-[300px] text-[15px] leading-relaxed text-muted">
            {es ? "Lo esencial de Haven es gratis. De por vida desbloquea todo lo demás, para siempre, sin suscripción." : "The core of Haven is free. Lifetime unlocks everything else, permanently, with no subscription."}
          </p>
          <div className="relative mt-8">
            {pricing ? (
              <p className="text-[64px] font-bold leading-none tracking-[-0.05em] tnum">
                {pricing.formatted}
                <span className="ml-2 align-middle text-[15px] font-medium tracking-normal text-muted">{es ? "una vez" : "once"}</span>
              </p>
            ) : (
              <Skeleton className="mx-auto h-12 w-36" />
            )}
          </div>
          {pricing?.student && (
            <p className="mt-3 inline-flex items-center gap-2 rounded-full bg-brand/15 px-3 py-1 text-[13px] font-semibold text-brand">
              <GraduationCap className="size-4" aria-hidden />
              {es ? `Precio de estudiante · ${pricing.student.percentOff}% menos ` : `Student price · ${pricing.student.percentOff}% off `}
              <span className="font-normal text-muted line-through">{pricing.student.fullFormatted}</span>
            </p>
          )}
          {pricing && !pricing.student && !owned && (
            <p className="mx-auto mt-3 flex max-w-[300px] items-start justify-center gap-2 text-[13px] leading-snug text-muted">
              <GraduationCap className="mt-0.5 size-4 shrink-0 text-brand" aria-hidden />
              <span>
                {es ? "¿Estudiante? Inicie sesión con su correo " : "Student? Sign in with your "}
                <span className="font-semibold text-text">.edu</span>
                {es ? " y queda en " : " email and it's "}
                <span className="font-semibold text-text">{pricing.studentFormatted}</span>.
              </span>
            </p>
          )}
          {pricing?.mode === "test" && <p className="mt-3 text-[12px] text-faint">{es ? "Modo de prueba · no se cobra nada real" : "Test mode · no real payment is taken"}</p>}
        </div>

        {canceled && !owned && <p className="mt-5 text-center text-[14px] text-muted">{es ? "Pago cancelado. No se le cobró." : "Checkout canceled. You weren't charged."}</p>}

        <div className="mt-8">
          {owned ? (
            <div className="rounded-card bg-ok/10 px-4 py-4 text-center text-[15px] font-medium text-ok">{es ? "Ya tiene Haven de por vida. Gracias." : "You own Haven Lifetime. Thank you."}</div>
          ) : (
            <Button variant="gold" size="lg" block onClick={checkout} loading={busy} disabled={!pricing || !viewer}>
              {pricing ? (es ? `Desbloquear por ${pricing.formatted}` : `Unlock for ${pricing.formatted}`) : es ? "Desbloquear De por vida" : "Unlock Lifetime"}
            </Button>
          )}
          {!owned && (
            <p className="mt-3 text-center text-[13px] leading-relaxed text-faint">
              {es ? "Se cobra una vez. Nada se renueva, así que no hay nada que cancelar." : "Charged once. Nothing renews, so there's nothing to cancel."}
              {!viewer?.email && (es ? " Primero verificará su correo para que la compra lo siga a cualquier dispositivo." : " You'll verify your email first so the purchase follows you to any device.")}
            </p>
          )}
        </div>

        <table className="mt-9 w-full border-collapse text-[14px]">
          <thead>
            <tr className="text-[12px] font-medium text-muted">
              <th className="pb-3 text-left font-medium">{es ? "Qué incluye" : "What you get"}</th>
              <th className="w-[72px] pb-3 text-center font-medium">{es ? "Gratis" : "Free"}</th>
              <th className="w-[72px] pb-3 text-center font-medium text-gold">{es ? "De por vida" : "Lifetime"}</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line">
            {ROWS.map((r) => (
              <tr key={r.feature}>
                <td className="py-3.5 pr-3 tracking-[-0.01em]">{es ? r.es : r.feature}</td>
                <Cell v={es && r.freeEs ? r.freeEs : r.free} es={es} />
                <Cell v={es && r.lifetimeEs ? r.lifetimeEs : r.lifetime} es={es} gold />
              </tr>
            ))}
          </tbody>
        </table>

        {owned && (
          <ButtonLink href="/" variant="secondary" block className="mt-8">
            {es ? "Volver al mapa" : "Back to map"}
          </ButtonLink>
        )}
      </div>
      <SignInSheet
        open={signIn}
        onClose={() => setSignIn(false)}
        reason={es ? "Verifique su correo para que su compra De por vida quede ligada a usted, no solo a este dispositivo." : "Verify your email so your Lifetime purchase is tied to you, not just this device."}
      />
    </main>
  );
}

function Cell({ v, gold, es }: { v: string | boolean; gold?: boolean; es?: boolean }) {
  return (
    <td className={`py-3.5 text-center tnum ${gold ? "text-text" : "text-muted"}`}>
      {v === true ? (
        <Check className={`mx-auto size-[18px] ${gold ? "text-gold" : "text-muted"}`} strokeWidth={2.4} aria-label={es ? "Incluido" : "Included"} />
      ) : v === false ? (
        <Minus className="mx-auto size-4 text-faint" aria-label={es ? "No incluido" : "Not included"} />
      ) : (
        v
      )}
    </td>
  );
}
