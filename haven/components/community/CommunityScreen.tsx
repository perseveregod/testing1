"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { CalendarPlus, MessageCircle, PartyPopper, Users } from "lucide-react";
import { BUCKET_LABEL, BUCKET_LABEL_ES, eventBucket, formatEventTime, useCommunityEvents } from "@/lib/client/community";
import { DEFAULT_CENTER } from "@/lib/client/defaults";
import { useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { useClock } from "@/lib/client/safewalk";
import { eventKind, EVENT_KINDS, type CommunityEvent, type EventKind } from "@/lib/community";
import { useLocation } from "@/components/providers/LocationProvider";
import { DemoNotice } from "@/components/incident/DemoNotice";
import { PageHeader } from "@/components/nav/PageHeader";
import { Chip } from "@/components/ui/Controls";
import { PullToRefresh } from "@/components/ui/PullToRefresh";
import { EmptyState, ErrorState, RowSkeleton } from "@/components/ui/States";
import { SignInSheet } from "@/components/profile/SignInSheet";
import { NewEventSheet } from "./NewEventSheet";

const ORDER = ["now", "today", "tomorrow", "week", "later"] as const;

/** Community tab: a board of local events people can join and talk about. */
export function CommunityScreen() {
  const { position } = useLocation();
  const center = position ?? DEFAULT_CENTER;
  const { events, error, isLoading, mutate } = useCommunityEvents(center, 25);
  const { viewer } = useViewer();
  const [kind, setKind] = useState<EventKind | "all">("all");
  const [creating, setCreating] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const { es } = useT();
  // Minute-level "now" so buckets and the Now badge stay pure during render.
  const now = Math.floor(useClock(true) / 60_000) * 60_000;

  const groups = useMemo(() => {
    const shown = kind === "all" ? events : events.filter((e) => e.kind === kind);
    const by = new Map<(typeof ORDER)[number], CommunityEvent[]>();
    for (const e of shown) {
      const b = eventBucket(e.startsAt, now);
      by.set(b, [...(by.get(b) ?? []), e]);
    }
    return ORDER.filter((b) => by.has(b)).map((b) => ({ id: b, label: es ? BUCKET_LABEL_ES[b] : BUCKET_LABEL[b], events: by.get(b)! }));
  }, [events, kind, now, es]);

  const kindsPresent = EVENT_KINDS.filter((k) => events.some((e) => e.kind === k.id));
  const allDemo = events.length > 0 && events.every((e) => e.isDemo);

  function startPost() {
    if (viewer?.email) setCreating(true);
    else setSignIn(true);
  }

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader
        title={es ? "Comunidad" : "Community"}
        large
        action={
          <button
            onClick={startPost}
            className="press mr-2 inline-flex min-h-11 items-center gap-1.5 rounded-full bg-surface-2 px-3.5 text-[14px] font-semibold text-brand"
          >
            <CalendarPlus className="size-4" aria-hidden /> {es ? "Publicar" : "Post"}
          </button>
        }
        sub={
          kindsPresent.length > 1 ? (
            <div className="no-scrollbar flex gap-2 overflow-x-auto px-5 pb-3 pt-1">
              <Chip active={kind === "all"} onClick={() => setKind("all")}>
                {es ? "Todo" : "All"}
              </Chip>
              {kindsPresent.map((k) => (
                <Chip key={k.id} active={kind === k.id} onClick={() => setKind(k.id)}>
                  <span className="size-2 rounded-full" style={{ background: k.color }} aria-hidden />
                  {es ? k.pluralEs : k.plural}
                </Chip>
              ))}
            </div>
          ) : null
        }
      />
      <PullToRefresh onRefresh={() => mutate()}>
        <div className="mx-auto max-w-lg px-4">
          <p className="px-1 pb-3 text-[13px] leading-snug text-muted">
            {es
              ? "Días comunitarios, limpiezas, reuniones y mercados a menos de 25 millas. Publicados por vecinos, para vecinos."
              : "Community days, cleanups, meetings and markets within 25 miles. Posted by neighbors, for neighbors."}
          </p>
          {allDemo && <DemoNotice className="mb-3 mt-0" />}
          {error ? (
            <ErrorState message={error.message ?? (es ? "No se pudo cargar el tablero." : "Couldn't load the board.")} onRetry={() => mutate()} />
          ) : isLoading ? (
            <div className="rounded-card bg-surface px-4">
              <RowSkeleton />
              <RowSkeleton />
            </div>
          ) : groups.length === 0 ? (
            <EmptyState
              icon={<PartyPopper className="size-9" strokeWidth={1.5} aria-hidden />}
              title={
                kind === "all"
                  ? es
                    ? "Aún no hay publicaciones"
                    : "Nothing posted yet"
                  : es
                    ? `No hay ${eventKind(kind).pluralEs.toLowerCase()} próximamente`
                    : `No ${eventKind(kind).plural.toLowerCase()} coming up`
              }
              body={es ? "¿Sabe de un día comunitario, limpieza o reunión cerca? Publíquelo para que los vecinos lo encuentren." : "Know about a community day, cleanup or meeting near you? Post it so neighbors can find it."}
              action={
                <button onClick={startPost} className="press inline-flex min-h-12 items-center gap-2 rounded-full bg-text px-5 text-[15px] font-semibold text-bg">
                  <CalendarPlus className="size-4" aria-hidden /> {es ? "Publicar un evento" : "Post an event"}
                </button>
              }
            />
          ) : (
            groups.map((g) => (
              <section key={g.id} className="mb-6" aria-labelledby={`grp-${g.id}`}>
                <h2 id={`grp-${g.id}`} className="mb-2 px-1 text-[13px] font-semibold text-muted">
                  {g.label}
                </h2>
                <ul className="space-y-2.5">
                  {g.events.map((e) => (
                    <EventCard key={e.id} event={e} now={now} />
                  ))}
                </ul>
              </section>
            ))
          )}
          <p className="px-1 pb-4 pt-2 text-[12px] leading-snug text-faint">
            {es
              ? "Los eventos los publican vecinos; Haven no los verifica. Reporte lo que parezca incorrecto; tres reportes ocultan una publicación."
              : "Events are posted by neighbors, not verified by Haven. Report anything that looks wrong; three reports hide a post."}
          </p>
        </div>
      </PullToRefresh>

      <NewEventSheet
        open={creating}
        onClose={() => setCreating(false)}
        near={center}
        onCreated={() => void mutate()}
      />
      <SignInSheet
        open={signIn}
        onClose={() => setSignIn(false)}
        reason={es ? "Inicie sesión con su correo para publicar eventos. Su correo nunca se muestra; aparece como un vecino numerado." : "Sign in with your email to post events. Your email is never shown; you appear as a numbered neighbor."}
        onSignedIn={() => {
          setSignIn(false);
          setCreating(true);
        }}
      />
    </main>
  );
}

function EventCard({ event, now }: { event: CommunityEvent; now: number }) {
  const { es, lang } = useT();
  const k = eventKind(event.kind);
  const live = now > 0 && new Date(event.startsAt).getTime() <= now;
  return (
    <li>
      <Link
        href={`/community/${encodeURIComponent(event.id)}`}
        prefetch={false}
        transitionTypes={["nav-forward"]}
        className="press block rounded-card bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]"
      >
        <div className="flex items-start gap-3">
          <span
            className="mt-1 size-3 shrink-0 rounded-full"
            style={{ background: k.color, boxShadow: live ? `0 0 0 4px ${k.color}33` : "none" }}
            aria-hidden
          />
          <div className="min-w-0 flex-1">
            <p className="text-[12px] font-semibold text-muted">
              {es ? k.labelEs : k.label}
              {event.isDemo && <span className="ml-1.5 rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-faint">Demo</span>}
            </p>
            <p className="mt-0.5 text-[17px] font-bold leading-tight tracking-[-0.015em]">{event.title}</p>
            <p className="mt-1 text-[13px] text-muted tnum">{formatEventTime(event.startsAt, event.endsAt, lang)}</p>
            <p className="truncate text-[13px] text-muted">{event.placeName}</p>
            <div className="mt-2.5 flex items-center gap-3 text-[13px] font-semibold text-muted tnum">
              <span className={`inline-flex items-center gap-1 ${event.viewerGoing ? "text-brand" : ""}`}>
                <Users className="size-4" aria-hidden /> {event.goingCount} {es ? "van" : "going"}
              </span>
              <span className="inline-flex items-center gap-1">
                <MessageCircle className="size-4" aria-hidden /> {event.commentCount}
              </span>
              {live && <span className="ml-auto rounded-full bg-live/15 px-2 py-0.5 text-[12px] font-bold text-live">{es ? "Ahora" : "Now"}</span>}
            </div>
          </div>
        </div>
      </Link>
    </li>
  );
}
