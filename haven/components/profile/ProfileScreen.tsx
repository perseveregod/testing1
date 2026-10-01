"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BarChart3, Bell, ChevronRight, Database, FileText, Languages, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { apiSend, fetcher } from "@/lib/client/api";
import { useNotifications, useViewer } from "@/lib/client/hooks";
import { setLang, useT } from "@/lib/client/lang";
import type { DataSource, PublicIncident } from "@/lib/types";
import { useToast } from "@/components/providers/ToastProvider";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { DemoTag, StatusPill } from "@/components/incident/Badges";
import { EmergencyNote } from "@/components/EmergencyNote";
import { PageHeader } from "@/components/nav/PageHeader";
import { Group, Row, Segmented } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/States";
import { PlacesSection } from "./PlacesSection";
import { InstallRow } from "@/components/onboarding/InstallRow";
import { SignInSheet } from "./SignInSheet";

export function ProfileScreen() {
  const { viewer, mutate } = useViewer();
  const { unread } = useNotifications();
  const toast = useToast();
  const { t, lang } = useT();
  const [signIn, setSignIn] = useState(false);

  async function signOut() {
    await apiSend("/api/auth/signout", "POST");
    await mutate();
    toast(t("profile.signedOut"), "info");
  }

  const initial = viewer?.email?.[0]?.toUpperCase();

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title={t("profile.title")} large />
      <div className="mx-auto max-w-lg px-4">
        {/* Account */}
        <div className="mt-2 flex items-center gap-4 px-1">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface-3 text-[22px] font-semibold text-muted">
            {initial ?? <span className="size-6 rounded-full bg-faint/50" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            {viewer ? (
              <>
                <p className="truncate text-[18px] font-semibold tracking-[-0.015em]">{viewer.email ?? t("profile.guest")}</p>
                <p className="text-[13.5px] text-muted">{viewer.email ? t("profile.signedIn") : t("profile.private")}</p>
              </>
            ) : (
              <>
                <Skeleton className="h-4 w-32" />
                <Skeleton className="mt-2 h-3 w-48" />
              </>
            )}
          </div>
          {viewer && !viewer.email && (
            <button onClick={() => setSignIn(true)} className="press h-10 rounded-full bg-surface-3 px-4 text-[14px] font-semibold">
              {t("profile.signIn")}
            </button>
          )}
        </div>

        {/* Plan */}
        {viewer &&
          (viewer.plan === "lifetime" ? (
            <div className="mt-6 flex items-center gap-3 rounded-card bg-surface px-4 py-3.5">
              <Sparkles className="size-5 shrink-0 text-gold" aria-hidden />
              <div className="flex-1">
                <p className="text-[15.5px] font-semibold tracking-[-0.01em]">{t("profile.lifetime")}</p>
                <p className="text-[13px] text-muted">{t("profile.lifetimeBody")}</p>
              </div>
            </div>
          ) : (
            <Link
              href="/upgrade"
              transitionTypes={["nav-forward"]}
              className="press mt-6 flex items-center gap-3 rounded-card bg-gradient-to-r from-gold/[0.14] to-surface px-4 py-3.5"
            >
              <Sparkles className="size-5 shrink-0 text-gold" aria-hidden />
              <div className="flex-1">
                <p className="text-[15.5px] font-semibold tracking-[-0.01em]">{t("profile.getLifetime")}</p>
                <p className="text-[13px] text-muted">{t("profile.getLifetimeBody")}</p>
              </div>
              <ChevronRight className="size-[18px] text-faint" aria-hidden />
            </Link>
          ))}

        <Group>
          <Row
            icon={<Bell className="size-5" />}
            title={t("profile.alerts")}
            detail={unread > 0 ? t("profile.unread", { n: unread }) : t("profile.alertsBody")}
            trailing={
              unread > 0 ? (
                <span className="min-w-[22px] rounded-full bg-danger px-1.5 text-center text-[12px] font-bold leading-[22px] text-white tnum">{unread > 9 ? "9+" : unread}</span>
              ) : undefined
            }
            href="/alerts"
          />
          <Row
            icon={<BarChart3 className="size-5" />}
            title={t("profile.insights")}
            detail={viewer?.limits.insightsDays === 30 ? t("profile.insights30") : t("profile.insights7")}
            href="/insights"
          />
          <div className="flex min-h-[52px] items-center gap-3 py-2.5">
            <span className="flex size-[30px] shrink-0 items-center justify-center text-muted" aria-hidden>
              <Languages className="size-5" />
            </span>
            <span className="min-w-0 flex-1">
              <span className="block truncate text-[16px] tracking-[-0.01em]">{t("profile.language")}</span>
            </span>
            <div className="w-[164px] shrink-0">
              <Segmented
                label={t("profile.language")}
                value={lang}
                onChange={setLang}
                options={[
                  { value: "en", label: "English" },
                  { value: "es", label: "Español" },
                ]}
              />
            </div>
          </div>
        </Group>
        <PlacesSection />
        <InstallRow />
        <MyReports />
        <SourcesSection />

        <Group title={t("profile.about")}>
          <Row icon={<ShieldCheck className="size-5" />} title={t("profile.guidelines")} href="/legal#safety" />
          <Row icon={<FileText className="size-5" />} title={t("profile.privacy")} href="/legal#privacy" />
          {viewer?.email && <Row icon={<LogOut className="size-5" />} title={t("profile.signOut")} onClick={signOut} tone="danger" />}
        </Group>

        <div className="mt-8">
          <EmergencyNote inline />
        </div>
        <p className="mt-5 pb-2 text-center text-[12px] text-faint">{t("profile.footer")}</p>
      </div>
      <SignInSheet open={signIn} onClose={() => setSignIn(false)} />
    </main>
  );
}

function MyReports() {
  const { viewer } = useViewer();
  const { t, timeAgo, title } = useT();
  const { data, isLoading } = useSWR<{ items: (PublicIncident & { merged: boolean; reportedAt: string })[] }>(viewer ? "/api/me/reports" : null, fetcher);
  const items = data?.items ?? [];
  return (
    <Group title={t("profile.reports")} footer={viewer?.plan === "free" && items.length > 0 ? t("profile.reportsFooter") : undefined}>
      {isLoading || !viewer ? (
        <div className="py-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Row title={<span className="text-[15px] text-muted">{t("profile.noReports")}</span>} />
      ) : (
        items.slice(0, 10).map((i) => (
          <Row
            key={i.id}
            href={`/incidents/${i.id}`}
            icon={<CategoryIcon category={i.category} size="sm" muted={i.status === "resolved"} />}
            title={title(i)}
            detail={`${timeAgo(i.reportedAt)}${i.merged ? t("profile.merged") : ""} · ${t("profile.confirmedN", { n: i.confirmationCount })}`}
            trailing={<StatusPill status={i.status} />}
          />
        ))
      )}
    </Group>
  );
}

function SourcesSection() {
  const { t } = useT();
  const { data } = useSWR<{ sources: DataSource[] }>("/api/sources", fetcher, { revalidateOnFocus: false });
  const sources = data?.sources.filter((s) => s.enabled) ?? [];
  return (
    <Group title={t("profile.sources")}>
      {sources.length === 0 ? (
        <div className="py-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : (
        sources.map((s) => (
          <div key={s.id} className="flex items-start gap-3 py-3">
            <Database className="mt-[3px] size-[18px] shrink-0 text-muted" aria-hidden />
            <div className="min-w-0 flex-1">
              <p className="flex items-center gap-2 text-[15px]">
                {s.name}
                {s.kind === "demo" && <DemoTag />}
              </p>
              <p className="mt-0.5 text-[13px] leading-snug text-muted">{s.attribution}</p>
            </div>
          </div>
        ))
      )}
    </Group>
  );
}
