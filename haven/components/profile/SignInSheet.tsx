"use client";

import { useState } from "react";
import { Mail } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
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
  const [busy, setBusy] = useState(false);

  async function sendCode(e: React.FormEvent) {
    e.preventDefault();
    setBusy(true);
    try {
      const r = await apiSend<{ devCode?: string }>("/api/auth/email/start", "POST", { email });
      setDevCode(r.devCode ?? null);
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

  return (
    <Sheet open={open} onClose={onClose} title={stage === "email" ? "Sign in with email" : "Enter your code"}>
      {stage === "email" ? (
        <form onSubmit={sendCode} className="pb-2">
          <p className="mb-3 text-[14px] leading-relaxed text-muted">
            {reason ?? "Keep your saved places, alerts and purchases on any device. No password needed."}
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
              placeholder="you@example.com"
              aria-label="Email address"
              className="min-w-0 flex-1 bg-transparent text-[16px] outline-none placeholder:text-faint"
            />
          </label>
          <Button type="submit" block size="lg" className="mt-3" loading={busy}>
            Send code
          </Button>
        </form>
      ) : (
        <form onSubmit={verify} className="pb-2">
          <p className="mb-3 text-[14px] text-muted">
            We sent a 6-digit code to <span className="font-semibold text-text">{email}</span>.
          </p>
          {devCode && (
            <p className="mb-3 rounded-xl bg-warn/10 px-3 py-2 text-[13px]">
              Development mode: email isn&apos;t configured, so your code is <span className="font-mono font-bold">{devCode}</span>
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
            aria-label="6-digit code"
            placeholder="••••••"
            className="h-14 w-full rounded-2xl bg-surface-2 text-center font-mono text-[24px] tracking-[0.5em] outline-none ring-brand/60 transition focus:ring-2"
          />
          <Button type="submit" block size="lg" className="mt-3" loading={busy} disabled={code.length !== 6}>
            Verify
          </Button>
          <button type="button" onClick={() => setStage("email")} className="mt-2 min-h-11 w-full text-[14px] text-muted">
            Use a different email
          </button>
        </form>
      )}
    </Sheet>
  );
}
