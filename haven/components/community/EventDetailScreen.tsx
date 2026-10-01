"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, Flag, MapPinned, MessageCircle, Send, Trash2, Users } from "lucide-react";
import { apiSend, errorMessage } from "@/lib/client/api";
import { formatEventTime, useCommunityEvent } from "@/lib/client/community";
import { useViewer } from "@/lib/client/hooks";
import { useT } from "@/lib/client/lang";
import { useClock } from "@/lib/client/safewalk";
import { setMapFocus } from "@/lib/client/mapFocus";
import { COMMUNITY_LIMITS, eventKind, isHappeningNow, type CommunityComment } from "@/lib/community";
import { MiniMap } from "@/components/map/MiniMap";
import { PageHeader } from "@/components/nav/PageHeader";
import { useToast } from "@/components/providers/ToastProvider";
import { SignInSheet } from "@/components/profile/SignInSheet";
import { Button } from "@/components/ui/Button";
import { ErrorState, RowSkeleton } from "@/components/ui/States";

export function EventDetailScreen({ id }: { id: string }) {
  const router = useRouter();
  const toast = useToast();
  const { event, error, isLoading, mutate } = useCommunityEvent(id);
  const { viewer } = useViewer();
  const [body, setBody] = useState("");
  const [sending, setSending] = useState(false);
  const [signIn, setSignIn] = useState(false);
  const requestId = useMemo(() => crypto.randomUUID(), []);
  const now = useClock(true);
  const { es, lang, timeAgo } = useT();

  async function toggleGoing() {
    if (!event) return;
    const going = !event.viewerGoing;
    try {
      await mutate(
        async (cur) => {
          const r = await apiSend<{ going: boolean; goingCount: number }>(`/api/community/events/${encodeURIComponent(event.id)}/going`, "POST", { going });
          return cur ? { event: { ...cur.event, viewerGoing: r.going, goingCount: r.goingCount } } : cur;
        },
        {
          optimisticData: (cur) =>
            cur ? { event: { ...cur.event, viewerGoing: going, goingCount: Math.max(0, cur.event.goingCount + (going ? 1 : -1)) } } : cur!,
          revalidate: false,
        },
      );
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  async function send() {
    if (!event || !body.trim()) return;
    if (!viewer?.email) {
      setSignIn(true);
      return;
    }
    setSending(true);
    try {
      const r = await apiSend<{ comment: CommunityComment }>(`/api/community/events/${encodeURIComponent(event.id)}/comments`, "POST", {
        body: body.trim(),
        clientRequestId: requestId,
      });
      setBody("");
      await mutate((cur) => (cur ? { event: { ...cur.event, commentCount: cur.event.commentCount + 1, comments: [...cur.event.comments, r.comment] } } : cur), {
        revalidate: true,
      });
    } catch (err) {
      toast(errorMessage(err), "error");
    } finally {
      setSending(false);
    }
  }

  async function flag(kind: "event" | "comment", targetId: string, mine: boolean) {
    try {
      const r = await apiSend<{ hidden: boolean; removed: boolean }>("/api/community/flag", "POST", { kind, id: targetId });
      if (kind === "event" && r.hidden) {
        toast(mine ? (es ? "Su evento fue eliminado." : "Your event was removed.") : es ? "Gracias. Este evento ya está oculto." : "Thanks. This event is hidden now.", "success");
        router.push("/community", { transitionTypes: ["nav-back"] });
        return;
      }
      toast(
        r.removed
          ? es
            ? "Eliminado."
            : "Removed."
          : r.hidden
            ? es
              ? "Gracias. Ese comentario ya está oculto."
              : "Thanks. That comment is hidden now."
            : es
              ? "Gracias. Lo ocultaremos si más vecinos lo reportan."
              : "Thanks. We'll hide it if more neighbors report it.",
        "success",
      );
      await mutate();
    } catch (err) {
      toast(errorMessage(err), "error");
    }
  }

  const k = event ? eventKind(event.kind) : null;

  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader
        title={k ? (es ? k.labelEs : k.label) : es ? "Evento" : "Event"}
        back="/community"
        action={
          event ? (
            <button
              onClick={() => flag("event", event.id, event.mine)}
              aria-label={event.mine ? (es ? "Eliminar mi evento" : "Remove my event") : es ? "Reportar este evento" : "Report this event"}
              className="press mr-1 flex size-11 items-center justify-center rounded-full text-muted"
            >
              {event.mine ? <Trash2 className="size-5" aria-hidden /> : <Flag className="size-5" aria-hidden />}
            </button>
          ) : null
        }
      />
      <div className="mx-auto max-w-lg px-4">
        {error ? (
          <ErrorState message={error.message ?? (es ? "No se pudo cargar este evento." : "Couldn't load this event.")} onRetry={() => mutate()} />
        ) : isLoading || !event || !k ? (
          <div className="rounded-card bg-surface px-4">
            <RowSkeleton />
          </div>
        ) : (
          <>
            <div className="haven-rise rounded-card bg-surface p-4 shadow-[inset_0_0_0_1px_var(--line)]">
              <div className="flex items-center gap-2 text-[12px] font-semibold text-muted">
                <span className="size-2.5 rounded-full" style={{ background: k.color }} aria-hidden />
                {es ? k.labelEs : k.label}
                {now > 0 && isHappeningNow(event, now) && <span className="rounded-full bg-live/15 px-2 py-0.5 text-[12px] font-bold text-live">{es ? "Pasando ahora" : "Happening now"}</span>}
                {event.isDemo && <span className="rounded-md bg-surface-3 px-1.5 py-0.5 text-[11px] font-semibold text-faint">Demo</span>}
              </div>
              <h1 className="mt-1.5 text-[24px] font-bold leading-tight tracking-[-0.02em]">{event.title}</h1>
              <p className="mt-2 text-[15px] text-text/90 tnum">{formatEventTime(event.startsAt, event.endsAt, lang)}</p>
              <p className="text-[15px] text-muted">{event.placeName}</p>
              {event.description && <p className="mt-3 whitespace-pre-line text-[15px] leading-relaxed text-text/90">{event.description}</p>}

              <div className="mt-4 flex gap-2">
                <Button
                  block
                  variant={event.viewerGoing ? "accent" : "primary"}
                  onClick={() => (viewer?.email ? toggleGoing() : setSignIn(true))}
                  aria-pressed={event.viewerGoing}
                >
                  {event.viewerGoing ? <Check className="size-4" aria-hidden /> : <Users className="size-4" aria-hidden />}
                  {event.viewerGoing ? (es ? "Va a ir" : "You're going") : es ? "Voy" : "I'm going"}
                  <span className="opacity-70 tnum">· {event.goingCount}</span>
                </Button>
                <button
                  onClick={() => {
                    setMapFocus({ lat: event.latitude, lng: event.longitude }, event.placeName);
                    router.push("/", { transitionTypes: ["tab"] });
                  }}
                  aria-label={es ? "Ver en el mapa" : "Show on the map"}
                  className="press flex size-12 shrink-0 items-center justify-center rounded-control bg-surface-3"
                >
                  <MapPinned className="size-5" aria-hidden />
                </button>
              </div>
            </div>

            <MiniMap
              mode="preview"
              center={{ lat: event.latitude, lng: event.longitude }}
              color={k.color}
              className="mt-3 h-40 overflow-hidden rounded-card"
              label={es ? `Mapa con la ubicación aproximada de ${event.title}` : `Map showing the approximate location of ${event.title}`}
              attribution={false}
            />

            <section className="mt-6" aria-labelledby="thread">
              <h2 id="thread" className="mb-2 flex items-center gap-1.5 px-1 text-[13px] font-semibold text-muted">
                <MessageCircle className="size-4" aria-hidden />{" "}
                {event.comments.length === 0
                  ? es
                    ? "Preguntas y novedades"
                    : "Questions and updates"
                  : es
                    ? `${event.comments.length} ${event.comments.length === 1 ? "comentario" : "comentarios"}`
                    : `${event.comments.length} ${event.comments.length === 1 ? "comment" : "comments"}`}
              </h2>
              {event.comments.length === 0 ? (
                <p className="rounded-card bg-surface px-4 py-5 text-center text-[14px] text-muted">
                  {es ? "Haga una pregunta o cuente qué esperar. Con respeto." : "Ask a question or share what to expect. Keep it friendly."}
                </p>
              ) : (
                <ul className="space-y-2">
                  {event.comments.map((c) => (
                    <li key={c.id} className={`rounded-card bg-surface p-3.5 ${c.mine ? "shadow-[inset_0_0_0_1px_var(--line)]" : ""}`}>
                      <div className="flex items-baseline gap-2 text-[12px]">
                        <span className="font-semibold text-text/85">{c.mine ? (es ? "Usted" : "You") : es ? c.author.replace(/^Neighbor/, "Vecino") : c.author}</span>
                        <span className="text-faint tnum">{now > 0 ? timeAgo(c.createdAt, now) : ""}</span>
                        <button
                          onClick={() => flag("comment", c.id, c.mine)}
                          aria-label={c.mine ? (es ? "Borrar mi comentario" : "Delete my comment") : es ? "Reportar este comentario" : "Report this comment"}
                          className="press ml-auto -mr-1 flex size-8 items-center justify-center rounded-full text-faint"
                        >
                          {c.mine ? <Trash2 className="size-3.5" aria-hidden /> : <Flag className="size-3.5" aria-hidden />}
                        </button>
                      </div>
                      <p className="mt-1 whitespace-pre-line text-[15px] leading-relaxed">{c.body}</p>
                    </li>
                  ))}
                </ul>
              )}

              <form
                onSubmit={(e) => {
                  e.preventDefault();
                  void send();
                }}
                className="mt-3 flex items-end gap-2"
              >
                <label className="min-w-0 flex-1">
                  <span className="sr-only">{es ? "Escriba un comentario" : "Write a comment"}</span>
                  <textarea
                    value={body}
                    onChange={(e) => setBody(e.target.value.slice(0, COMMUNITY_LIMITS.comment))}
                    rows={1}
                    placeholder={viewer?.email ? (es ? "Agregar un comentario…" : "Add a comment…") : es ? "Inicie sesión para comentar" : "Sign in to comment"}
                    onFocus={() => {
                      if (!viewer?.email) setSignIn(true);
                    }}
                    className="w-full resize-none rounded-card bg-surface-2 px-3.5 py-3 text-[16px] outline-none ring-brand/60 placeholder:text-faint focus:ring-2"
                  />
                </label>
                <Button type="submit" loading={sending} disabled={!body.trim()} aria-label={es ? "Enviar" : "Send"} className="size-12 !px-0">
                  <Send className="size-5" aria-hidden />
                </Button>
              </form>
              <p className="mt-2 px-1 text-[12px] leading-snug text-faint">
                {es
                  ? "Aparece como un vecino numerado, nunca su correo. Sin teléfonos, enlaces ni datos personales; tres reportes ocultan un comentario."
                  : "You appear as a numbered neighbor, never your email. No phone numbers, links or personal details; three reports hide a comment."}
              </p>
            </section>
          </>
        )}
      </div>
      <SignInSheet
        open={signIn}
        onClose={() => setSignIn(false)}
        reason={es ? "Inicie sesión con su correo para unirse y comentar. Aparece como un vecino numerado; su correo nunca se muestra." : "Sign in with your email to join and comment. You appear as a numbered neighbor; your email is never shown."}
      />
    </main>
  );
}
