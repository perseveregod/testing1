"use client";

import { useEffect, useState } from "react";
import { Smartphone } from "lucide-react";
import { useT } from "@/lib/client/lang";
import { useStandalone } from "@/lib/client/push";
import { Group, Row } from "@/components/ui/Controls";
import { InstallSheet } from "./InstallSheet";

type BeforeInstallPromptEvent = Event & { prompt: () => Promise<void>; userChoice: Promise<{ outcome: "accepted" | "dismissed" }> };

let deferred: BeforeInstallPromptEvent | null = null;
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferred = e as BeforeInstallPromptEvent;
  });
}

/** Profile row: put Haven on the Home Screen (Android prompts; iPhone gets the steps). */
export function InstallRow() {
  const standalone = useStandalone();
  const [open, setOpen] = useState(false);
  const [canPrompt, setCanPrompt] = useState(false);
  const { t } = useT();
  useEffect(() => {
    const t = setTimeout(() => setCanPrompt(Boolean(deferred)), 0);
    return () => clearTimeout(t);
  }, []);
  if (standalone) return null;
  return (
    <Group>
      <Row
        icon={<Smartphone className="size-5" />}
        title={t("install.title")}
        detail={t("install.row")}
        onClick={async () => {
          if (deferred) {
            await deferred.prompt();
            const { outcome } = await deferred.userChoice;
            if (outcome === "accepted") deferred = null;
            setCanPrompt(Boolean(deferred));
          } else {
            setOpen(true);
          }
        }}
        trailing={canPrompt ? <span className="text-[13px] font-semibold text-brand">{t("common.install")}</span> : undefined}
      />
      <InstallSheet open={open} onClose={() => setOpen(false)} />
    </Group>
  );
}
