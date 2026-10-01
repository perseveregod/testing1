"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import type { Viewer } from "@/lib/types";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

/** Email one-time-code sign-in. Attaches the email to the current guest account. */
export function SignInSheet({
  open,
  onClose,
  onSignedIn,
  reason,
}: {
  open: boolean;
  onClose: () => void;
  onSignedIn?: (v: Viewer) => void;
  reason?: string;
}) {
  const toast = useToast();
  const { mutate } = useViewer();
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [stage, setStage] = useState<"email" | "code">("email");
  const [devCode, setDevCode] = useState<string | null>(null);
  const [mode, setMode] = useState<"code" | "link">("code");
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await apiSend<{ devCode?: string; mode?: "code" | "link" }>("/api/auth/email/start", "POST", { email });
      setDevCode(r.devCode ?? null);
      setMode(r.mode ?? "code");
      setStage("code");
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  async function verify(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await apiSend<{ viewer: Viewer }>("/api/auth/email/verify", "POST", { email, code });
      await mutate({ viewer: r.viewer }, { revalidate: false });
      toast("You're signed in.", "success");
      setStage("email");
      setCode("");
      onSignedIn?.(r.viewer);
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  const { es } = useT();
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={stage === "email" ? (es ? "Iniciar sesión con correo" : "Sign in with email") : mode === "link" ? (es ? "Revise su correo" : "Check your email") : es ? "Escriba su código" : "Enter your code"}
    >
      {stage === "email" ? (
        <form onSubmit={sendCode} className="pb-2">
          <p className="mb-3 text-[14px] leading-relaxed text-muted">
            {reason ?? (es ? "Conserve sus lugares, alertas y compras en cualquier dispositivo. Sin contraseña." : "Keep your saved places, alerts and purchases on any device. No password needed.")}
          </p>
          <label className="flex h-12 items-center gap-2.5 rounded-full bg-surface-2 px-4 ring-brand/60 transition focus-within:ring-2">
            <Mail className="size-[18px] text-muted" aria-hidden />
            <input
              type="email"
              required
              autoComplete="email"
              inputMode="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder={es ? "usted@ejemplo.com" : "you@example.com"}
              aria-label={es ? "Correo electrónico" : "Email address"}
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
            />
          </label>
          <Button type="submit" block size="lg" className="mt-3" loading={busy}>
            {es ? "Enviar código" : "Send code"}
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="pb-2">
          {!devCode && (
            <p className="mb-3 text-[14px] text-muted">
              {es ? "Enviamos un código de 6 dígitos a " : "We sent a 6-digit code to "}
              <span className="font-semibold text-text">{email}</span>.
            </p>
          )}
          {devCode && (
            <p className="mb-3 rounded-control bg-warn/10 px-3 py-2 text-[13px]">
              {es ? "Modo demo: aún no hay servicio de correo, así que su código aparece aquí: " : "Demo mode: no email service is connected yet, so your code is shown here: "}
              <span className="font-mono font-bold">{devCode}</span>
            </p>
          )}
          <input
            inputMode="numeric"
            autoComplete="one-time-code"
            pattern="\d{6}"
            maxLength={6}
            required
            autoFocus
            value={code}
            onChange={(e) => setCode(e.target.value.replace(/\D/g, ""))}
            aria-label={es ? "Código de 6 dígitos" : "6-digit code"}
            placeholder="••••••"
            className="h-14 w-full rounded-card bg-surface-2 text-center font-mono text-[24px] tracking-[0.5em] outline-none ring-brand/60 transition focus:ring-2"
          />
          <Button type="submit" block size="lg" className="mt-3" loading={busy} disabled={code.length !== 6}>
            {es ? "Verificar" : "Verify"}
          </Button>
          <button type="button" onClick={() => setStage("email")} className="mt-2 min-h-11 w-full text-[14px] text-muted">
            {es ? "Usar otro correo" : "Use a different email"}
          </button>
        </form>
      )}
    </Sheet>
  );
}
