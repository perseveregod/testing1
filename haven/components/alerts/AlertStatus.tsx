"use client";

import { useState } from "react";
import { BellRing, Check, MapPin, Send } from "lucide-react";
import { blockedHelp, type Readiness } from "@/lib/alertReadiness";
import { useT } from "@/lib/client/lang";
import type { Key } from "@/lib/i18n";
import type { TestResult } from "@/lib/client/push";
import type { useAlertReadiness } from "@/lib/client/readiness";
import { InstallSheet } from "@/components/onboarding/InstallSheet";
import { Button, ButtonLink } from "@/components/ui/Button";

const STATE: Record<Readiness, { title: Key; body: Key; tone: string; dot: string }> = {
  off: { title: "ready.off", body: "ready.offBody", tone: "text-muted", dot: "bg-faint" },
  setup_needed: { title: "ready.setup", body: "ready.setupBody", tone: "text-warn", dot: "bg-warn" },
  inbox_only: { title: "ready.inbox", body: "ready.inboxBody", tone: "text-warn", dot: "bg-warn" },
  push_untested: { title: "ready.untested", body: "ready.untestedBody", tone: "text-warn", dot: "bg-warn" },
  push_ready: { title: "ready.push", body: "ready.pushBody", tone: "text-ok", dot: "bg-ok" },
};

/**
 * What can actually be delivered right now, and the three things that get
 * someone from "Setup needed" to "Push ready": an area, permission on this
 * device, and a test that was seen arriving. Nothing here is inferred from a
 * switch being on.
 */
export function AlertStatus({ readiness, onUseArea }: { readiness: ReturnType<typeof useAlertReadiness>; onUseArea: () => void }) {
  const { t, timeAgo } = useT();
  const { push, state, hasArea, watchedPlaces, nearMe } = readiness;
  const [installOpen, setInstallOpen] = useState(false);
  const [test, setTest] = useState<TestResult | "waiting" | null>(null);
  const s = STATE[state];
  const when = push.verifiedAt ? timeAgo(new Date(push.verifiedAt).toISOString()) : "";

  async function runTest() {
    setTest("waiting");
    setTest(await push.sendTest().catch(() => "not_sent" as const));
  }

  const areaText =
    watchedPlaces > 0 && nearMe === "on"
      ? t("ready.step1Both", { n: watchedPlaces })
      : watchedPlaces > 0
        ? watchedPlaces === 1
          ? t("ready.step1Places1")
          : t("ready.step1Places", { n: watchedPlaces })
        : nearMe === "on"
          ? t("ready.step1NearMe")
          : t("ready.step1Todo");

  const pushOn = push.status === "on";
  const help = typeof navigator === "undefined" ? "generic" : blockedHelp(navigator.userAgent, push.standalone, navigator.maxTouchPoints);

  return (
    <section aria-labelledby="alert-status" className="mt-4 rounded-card bg-surface p-4">
      <p id="alert-status" className="text-[13px] font-medium text-muted">
        {t("ready.heading")}
      </p>
      <p className={`mt-1 flex items-center gap-2 text-[20px] font-bold tracking-[-0.02em] ${s.tone}`} role="status">
        <span className={`size-2.5 shrink-0 rounded-full ${s.dot}`} aria-hidden />
        {t(s.title)}
      </p>
      <p className="mt-1 text-[14px] leading-snug text-muted">{t(s.body, { t: when })}</p>

      <ol className="mt-4 divide-y divide-line border-t border-line">
        <Step n={1} done={hasArea} icon={<MapPin className="size-[18px]" aria-hidden />} title={t("ready.step1")}>
          <p>{areaText}</p>
          {nearMe === "blocked" && <p className="mt-1 text-warn">{t("ready.step1Blocked")}</p>}
          {!hasArea && (
            <div className="mt-2.5 flex flex-wrap gap-2">
              <ButtonLink href="/profile#places" size="sm" transitionTypes={["tab"]}>
                {t("ready.addPlace")}
              </ButtonLink>
              <Button size="sm" variant="secondary" onClick={onUseArea}>
                {t("ready.useArea")}
              </Button>
            </div>
          )}
        </Step>

        <Step n={2} done={pushOn} icon={<BellRing className="size-[18px]" aria-hidden />} title={t("ready.step2")}>
          {pushOn && <p>{t("ready.step2On")}</p>}
          {push.status === "off" && (
            <>
              <p>{t("ready.step2Off")}</p>
              <Button size="sm" className="mt-2.5" onClick={push.enable} loading={push.busy}>
                {t("ready.allow")}
              </Button>
            </>
          )}
          {push.status === "denied" && (
            <>
              <p className="text-warn">{t("ready.step2Denied")}</p>
              <p className="mt-1">{t(`ready.help.${help}` as Key)}</p>
            </>
          )}
          {push.status === "install" && (
            <>
              <p>{t("ready.step2Install")}</p>
              <Button size="sm" className="mt-2.5" onClick={() => setInstallOpen(true)}>
                {t("common.showMeHow")}
              </Button>
            </>
          )}
          {push.status === "unsupported" && <p>{t("ready.step2Unsupported")}</p>}
          {push.status === "setup" && <p>{t("ready.step2Setup")}</p>}
          {push.error && <p className="mt-1 text-danger">{push.error}</p>}
        </Step>

        <Step n={3} done={push.verifiedAt != null} icon={<Send className="size-[18px]" aria-hidden />} title={t("ready.step3")}>
          {!pushOn ? (
            <p>{t("ready.step3Todo")}</p>
          ) : (
            <>
              <p aria-live="polite">
                {test === "waiting"
                  ? t("ready.step3Waiting")
                  : test === "sent_not_seen"
                    ? t("ready.step3NotSeen")
                    : test === "not_sent"
                      ? t("ready.step3NotSent")
                      : push.verifiedAt
                        ? t("ready.step3Received", { t: when })
                        : t("ready.step3Ready")}
              </p>
              <div className="mt-2.5 flex flex-wrap gap-2">
                <Button size="sm" variant={push.verifiedAt ? "secondary" : "primary"} onClick={runTest} loading={test === "waiting"}>
                  {push.verifiedAt ? t("ready.sendAgain") : t("push.sendTest")}
                </Button>
                {test === "sent_not_seen" && (
                  <Button
                    size="sm"
                    variant="secondary"
                    onClick={async () => {
                      await push.confirmSeen();
                      setTest(null);
                    }}
                  >
                    {t("ready.sawIt")}
                  </Button>
                )}
                <Button size="sm" variant="ghost" onClick={push.disable} loading={push.busy}>
                  {t("push.turnOffDevice")}
                </Button>
              </div>
            </>
          )}
        </Step>
      </ol>
      <InstallSheet open={installOpen} onClose={() => setInstallOpen(false)} />
    </section>
  );
}

function Step({ n, done, icon, title, children }: { n: number; done: boolean; icon: React.ReactNode; title: string; children: React.ReactNode }) {
  const { t } = useT();
  return (
    <li className="flex gap-3.5 py-3.5">
      <span className={`mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-full ${done ? "bg-ok/15 text-ok" : "bg-surface-3 text-muted"}`} aria-hidden>
        {done ? <Check className="size-[18px]" strokeWidth={2.6} /> : icon}
      </span>
      <div className="min-w-0 flex-1">
        <p className="text-[15px] font-semibold tracking-[-0.01em]">
          <span className="sr-only">
            {t("common.step", { n })}
            {done ? `, ${t("common.done")}` : ""}:{" "}
          </span>
          {title}
        </p>
        <div className="mt-0.5 text-[13px] leading-snug text-muted">{children}</div>
      </div>
    </li>
  );
}
