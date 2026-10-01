"use client";

import { useState } from "react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { useT } from "@/lib/client/lang";
import { MAX_UPDATE } from "@/lib/moderation";
import { useToast } from "@/components/providers/ToastProvider";
import { Button } from "@/components/ui/Button";
import { Sheet } from "@/components/ui/Sheet";

export function AddInfoSheet({
  incidentId,
  open,
  onClose,
  onDone,
}: {
  incidentId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { t, es } = useT();
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await apiSend<{ redacted: boolean }>(`/api/incidents/${incidentId}/updates`, "POST", { body: text });
      toast(r.redacted ? t("inc.updateRedacted") : t("inc.updateAdded"), "success");
      setText("");
      onDone();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(false);
    }
  }

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("inc.addInformation")}
      footer={
        <Button block size="lg" onClick={submit} loading={busy} disabled={!text.trim()}>
          {es ? "Publicar actualización" : "Post update"}
        </Button>
      }
    >
      <p className="mb-3 text-[14px] leading-relaxed text-muted">
        {es
          ? "Comparta lo que pueda ver desde una distancia segura, como calles cerradas o si las unidades ya se fueron. No incluya nombres, caras ni datos personales."
          : "Share what you can see from a safe distance, like road closures or whether crews have left. Don't include names, faces or personal details."}
      </p>
      <label className="sr-only" htmlFor="info">
        {es ? "Actualización" : "Update"}
      </label>
      <textarea
        id="info"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_UPDATE))}
        rows={4}
        placeholder={t("inc.updatePlaceholder")}
        className="w-full resize-none rounded-card bg-surface-2 p-4 text-[16px] leading-relaxed outline-none ring-brand/60 transition placeholder:text-faint focus:ring-2"
      />
      <p className="mt-1.5 text-right text-[12px] text-faint tnum">
        {text.length}/{MAX_UPDATE}
      </p>
    </Sheet>
  );
}

const FLAG_REASONS = [
  { id: "false", en: "This didn't happen / is misleading", es: "Esto no pasó / es engañoso" },
  { id: "duplicate", en: "Duplicate of another incident", es: "Duplicado de otro incidente" },
  { id: "personal_info", en: "Contains personal information", es: "Contiene información personal" },
  { id: "offensive", en: "Offensive, harassing or discriminatory", es: "Ofensivo, acosador o discriminatorio" },
  { id: "other", en: "Something else", es: "Otra cosa" },
] as const;

export function FlagSheet({
  incidentId,
  open,
  onClose,
  onDone,
}: {
  incidentId: string;
  open: boolean;
  onClose: () => void;
  onDone: () => void;
}) {
  const toast = useToast();
  const { t, es } = useT();
  const [busy, setBusy] = useState<string | null>(null);

  async function flag(reason: string) {
    setBusy(reason);
    try {
      await apiSend(`/api/incidents/${incidentId}/flag`, "POST", { reason });
      toast(es ? "Gracias. Revisaremos este reporte." : "Thanks. We'll review this report.", "success");
      onDone();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title={t("inc.reportProblem")}>
      <p className="mb-3 text-[14px] text-muted">
        {es ? "Los reportes de la comunidad que varias personas marcan se ocultan mientras se revisan." : "Community reports that several people flag are hidden while they're reviewed."}
      </p>
      <ul className="divide-y divide-line overflow-hidden rounded-card bg-surface-2 pb-0">
        {FLAG_REASONS.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => flag(r.id)}
              disabled={busy !== null}
              className="flex min-h-[52px] w-full items-center px-4 py-3 text-left text-[15px] transition active:bg-surface-3 disabled:opacity-60"
            >
              <span className="flex-1">{es ? r.es : r.en}</span>
              {busy === r.id && <span className="text-[13px] text-muted">{t("inc.sending")}</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="h-2" />
    </Sheet>
  );
}
