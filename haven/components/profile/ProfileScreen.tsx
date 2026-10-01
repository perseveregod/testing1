"use client";

import { useState } from "react";
import Link from "next/link";
import useSWR from "swr";
import { BarChart3, ChevronRight, Database, FileText, LogOut, ShieldCheck, Sparkles } from "lucide-react";
import { apiSend, fetcher } from "@/lib/client/api";
import { useViewer } from "@/lib/client/hooks";
import { timeAgo } from "@/lib/time";
import type { DataSource, PublicIncident } from "@/lib/types";
import { useToast } from "@/components/providers/ToastProvider";
import { CategoryIcon } from "@/components/incident/CategoryIcon";
import { DemoTag, StatusPill } from "@/components/incident/Badges";
import { EmergencyNote } from "@/components/EmergencyNote";
import { PageHeader } from "@/components/nav/PageHeader";
import { ButtonLink } from "@/components/ui/Button";
import { Group, Row } from "@/components/ui/Controls";
import { Skeleton } from "@/components/ui/States";
import { PlacesSection } from "./PlacesSection";
import { SignInSheet } from "./SignInSheet";

export function ProfileScreen() {
  const { viewer, mutate } = useViewer();
  const toast = useToast();
  const [signIn, setSignIn] = useState(false);

  async function signOut() {
    await apiSend("/api/auth/signout", "POST");
    await mutate();
    toast("Signed out. You're now browsing as a guest.", "info");
  }

  const initial = viewer?.email?.[0]?.toUpperCase();

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title="Profile" large />
      <div className="mx-auto max-w-lg px-4">
        {/* Account */}
        <div className="mt-2 flex items-center gap-4 px-1">
          <span className="flex size-14 items-center justify-center rounded-full bg-surface-3 text-[22px] font-semibold text-muted">
            {initial ?? <span className="size-6 rounded-full bg-faint/50" aria-hidden />}
          </span>
          <div className="min-w-0 flex-1">
            {viewer ? (
              <>
                <p className="truncate text-[18px] font-semibold tracking-[-0.015em]">{viewer.email ?? "Guest"}</p>
                <p className="text-[13.5px] text-muted">{viewer.email ? "Signed in with email" : "Private account on this device"}</p>
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
              Sign in
            </button>
          )}
        </div>

        {/* Plan */}
        {viewer &&
          (viewer.plan === "lifetime" ? (
            <div className="mt-6 flex items-center gap-3 rounded-[20px] bg-surface px-4 py-3.5">
              <Sparkles className="size-5 shrink-0 text-gold" aria-hidden />
              <div className="flex-1">
                <p className="text-[15.5px] font-semibold tracking-[-0.01em]">Haven Lifetime</p>
                <p className="text-[13px] text-muted">Paid once. Everything unlocked, for good.</p>
              </div>
            </div>
          ) : (
            <Link
              href="/upgrade"
              transitionTypes={["nav-forward"]}
              className="press mt-6 flex items-center gap-3 rounded-[20px] bg-gradient-to-r from-gold/[0.14] to-surface px-4 py-3.5"
            >
              <Sparkles className="size-5 shrink-0 text-gold" aria-hidden />
              <div className="flex-1">
                <p className="text-[15.5px] font-semibold tracking-[-0.01em]">Get Haven Lifetime</p>
                <p className="text-[13px] text-muted">One payment, no subscription</p>
              </div>
              <ChevronRight className="size-[18px] text-faint" aria-hidden />
            </Link>
          ))}

        <Group>
          <Row
            icon={<BarChart3 className="size-5" />}
            title="Area insights"
            detail={viewer?.limits.insightsDays === 30 ? "30-day trends near you and your places" : "7-day trends · 30 days with Lifetime"}
            href="/insights"
          />
        </Group>
        <PlacesSection />
        <MyReports />
        <SourcesSection />

        <Group title="About">
          <Row icon={<ShieldCheck className="size-5" />} title="Safety & community guidelines" href="/legal#safety" />
          <Row icon={<FileText className="size-5" />} title="Privacy" href="/legal#privacy" />
          {viewer?.email && <Row icon={<LogOut className="size-5" />} title="Sign out" onClick={signOut} tone="danger" />}
        </Group>

        <div className="mt-8">
          <EmergencyNote compact />
        </div>
        <p className="mt-5 pb-2 text-center text-[12px] text-faint">Haven · community safety information, not an emergency service</p>
      </div>
      <SignInSheet open={signIn} onClose={() => setSignIn(false)} />
    </main>
  );
}

function MyReports() {
  const { viewer } = useViewer();
  const { data, isLoading } = useSWR<{ items: (PublicIncident & { merged: boolean; reportedAt: string })[] }>(viewer ? "/api/me/reports" : null, fetcher);
  const items = data?.items ?? [];
  return (
    <Group title="Your reports" footer={viewer?.plan === "free" && items.length > 0 ? "Showing the last 24 hours." : undefined}>
      {isLoading || !viewer ? (
        <div className="py-4">
          <Skeleton className="h-10 w-full" />
        </div>
      ) : items.length === 0 ? (
        <Row title={<span className="text-[15px] text-muted">Nothing reported recently</span>} trailing={<ButtonLink href="/report" variant="secondary" size="sm">Report</ButtonLink>} />
      ) : (
        items.slice(0, 10).map((i) => (
          <Row
            key={i.id}
            href={`/incidents/${i.id}`}
            icon={<CategoryIcon category={i.category} size="sm" muted={i.status === "resolved"} />}
            title={i.title}
            detail={`${timeAgo(i.reportedAt)}${i.merged ? " · added to an existing report" : ""} · ${i.confirmationCount} confirmed`}
            trailing={<StatusPill status={i.status} />}
          />
        ))
      )}
    </Group>
  );
}

function SourcesSection() {
  const { data } = useSWR<{ sources: DataSource[] }>("/api/sources", fetcher, { revalidateOnFocus: false });
  const sources = data?.sources.filter((s) => s.enabled) ?? [];
  return (
    <Group title="Data sources">
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
