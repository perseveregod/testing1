"use client";

import { useState } from "react";
import { apiSend, errorMessage } from "@/lib/client/api";
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
  const [text, setText] = useState("");
  const [busy, setBusy] = useState(false);

  async function submit() {
    setBusy(true);
    try {
      const r = await apiSend<{ redacted: boolean }>(`/api/incidents/${incidentId}/updates`, "POST", { body: text });
      toast(r.redacted ? "Update added. Personal details were removed." : "Update added. Thank you.", "success");
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
      title="Add information"
      footer={
        <Button block size="lg" onClick={submit} loading={busy} disabled={!text.trim()}>
          Post update
        </Button>
      }
    >
      <p className="mb-3 text-[14px] leading-relaxed text-muted">
        Share what you can see from a safe distance, like road closures or whether crews have left. Don&apos;t include
        names, faces or personal details.
      </p>
      <label className="sr-only" htmlFor="info">
        Update
      </label>
      <textarea
        id="info"
        value={text}
        onChange={(e) => setText(e.target.value.slice(0, MAX_UPDATE))}
        rows={4}
        placeholder="e.g. Two lanes now open, traffic moving slowly"
        className="w-full resize-none rounded-2xl bg-surface-2 p-4 text-[16px] leading-relaxed outline-none ring-brand/60 transition placeholder:text-faint focus:ring-2"
      />
      <p className="mt-1.5 text-right text-[12px] text-faint tnum">
        {text.length}/{MAX_UPDATE}
      </p>
    </Sheet>
  );
}

const FLAG_REASONS = [
  { id: "false", label: "This didn't happen / is misleading" },
  { id: "duplicate", label: "Duplicate of another incident" },
  { id: "personal_info", label: "Contains personal information" },
  { id: "offensive", label: "Offensive, harassing or discriminatory" },
  { id: "other", label: "Something else" },
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
  const [busy, setBusy] = useState<string | null>(null);

  async function flag(reason: string) {
    setBusy(reason);
    try {
      await apiSend(`/api/incidents/${incidentId}/flag`, "POST", { reason });
      toast("Thanks. We'll review this report.", "success");
      onDone();
      onClose();
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setBusy(null);
    }
  }

  return (
    <Sheet open={open} onClose={onClose} title="Report a problem">
      <p className="mb-3 text-[14px] text-muted">Community reports that several people flag are hidden while they&apos;re reviewed.</p>
      <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface-2 pb-0">
        {FLAG_REASONS.map((r) => (
          <li key={r.id}>
            <button
              onClick={() => flag(r.id)}
              disabled={busy !== null}
              className="flex min-h-[52px] w-full items-center px-4 py-3 text-left text-[15.5px] transition active:bg-surface-3 disabled:opacity-60"
            >
              <span className="flex-1">{r.label}</span>
              {busy === r.id && <span className="text-[13px] text-muted">Sending…</span>}
            </button>
          </li>
        ))}
      </ul>
      <div className="h-2" />
    </Sheet>
  );
}
