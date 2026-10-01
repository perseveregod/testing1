"use client";

import { useRef, useState } from "react";
import { BellRing, Check, Volume2, MessageSquare, Phone, Plus, Share2, ShieldCheck, Trash2, UserPlus } from "lucide-react";
import {
  cleanPhone,
  DURATIONS_MIN,
  formatRemaining,
  GRACE_MS,
  MAX_CONTACTS,
  missedMessage,
  setSafeWalk,
  smsHref,
  startMessage,
  useClock,
  useSafeWalk,
  type ActiveWalk,
  type TrustedContact,
} from "@/lib/client/safewalk";
import { primeAlarm, startAlarm, stopAlarm, useAlarmBlocked } from "@/lib/client/alarm";
import { EMERGENCY_NUMBER } from "@/lib/client/defaults";
import { useT } from "@/lib/client/lang";
import { useLocation } from "@/components/providers/LocationProvider";
import { useToast } from "@/components/providers/ToastProvider";
import { PageHeader } from "@/components/nav/PageHeader";
import { Button } from "@/components/ui/Button";
import { Segmented } from "@/components/ui/Controls";

type WakeLockLike = { release: () => Promise<void> };

export function SafeWalkScreen() {
  const toast = useToast();
  const { es, lang } = useT();
  const { position, request } = useLocation();
  const state = useSafeWalk();
  const [minutes, setMinutes] = useState<number>(15);
  const [destination, setDestination] = useState("");
  const [name, setName] = useState("");
  const [phone, setPhone] = useState("");
  const soundBlocked = useAlarmBlocked();
  const wake = useRef<WakeLockLike | null>(null);
  // Ending a walk takes two taps so a pocket tap can't silently stop it.
  const [armed, setArmed] = useState(false);
  const armTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  function safeTap() {
    if (armed) {
      if (armTimer.current) clearTimeout(armTimer.current);
      setArmed(false);
      finish(es ? "Qué bueno que llegó. Camino seguro terminado." : "Glad you made it. Safe Walk ended.");
      return;
    }
    setArmed(true);
    armTimer.current = setTimeout(() => setArmed(false), 4000);
  }

  const update = setSafeWalk;
  const walk = state?.walk ?? null;
  const now = useClock(walk != null);

  const remaining = walk ? walk.endsAt - now : 0;
  const overdue = walk != null && now > 0 && remaining <= 0;
  const alerting = overdue && -remaining >= GRACE_MS;

  // The siren itself is run app-wide by SafeWalkWatcher.

  async function keepScreenOn() {
    try {
      const wl = (navigator as Navigator & { wakeLock?: { request: (t: "screen") => Promise<WakeLockLike> } }).wakeLock;
      wake.current = (await wl?.request("screen")) ?? null;
    } catch {
      wake.current = null;
    }
  }

  function start() {
    if (!state) return;
    // Must happen inside the tap so browsers allow the alarm sound later.
    primeAlarm();
    if (!position) request();
    const t = Date.now();
    const next: ActiveWalk = { startedAt: t, endsAt: t + minutes * 60_000, destination: destination.trim().slice(0, 60) };
    update({ ...state, walk: next });
    void keepScreenOn();
  }

  function finish(message: string) {
    if (!state) return;
    stopAlarm();
    update({ ...state, walk: null });
    void wake.current?.release().catch(() => {});
    wake.current = null;
    toast(message, "success");
  }

  function extend(min: number) {
    if (!state?.walk) return;
    const base = Math.max(state.walk.endsAt, Date.now());
    update({ ...state, walk: { ...state.walk, endsAt: base + min * 60_000 } });
  }

  function addContact() {
    if (!state) return;
    const cleaned = cleanPhone(phone);
    if (!name.trim() || !cleaned) {
      toast(es ? "Agregue un nombre y un teléfono válido." : "Add a name and a valid phone number.", "error");
      return;
    }
    const c: TrustedContact = { id: `${Date.now()}`, name: name.trim().slice(0, 40), phone: cleaned };
    update({ ...state, contacts: [...state.contacts, c].slice(0, MAX_CONTACTS) });
    setName("");
    setPhone("");
  }

  function removeContact(id: string) {
    if (!state) return;
    update({ ...state, contacts: state.contacts.filter((c) => c.id !== id) });
  }

  async function shareText(text: string) {
    if (navigator.share) {
      try {
        await navigator.share({ text });
        return;
      } catch {
        // Cancelled: fall through to copy.
      }
    }
    try {
      await navigator.clipboard.writeText(text);
      toast(es ? "Mensaje copiado. Péguelo a alguien de confianza." : "Message copied. Paste it to someone you trust.", "success");
    } catch {
      toast(es ? "No se pudo compartir. Use los botones de mensaje." : "Couldn't share. Use the text buttons instead.", "error");
    }
  }

  const TITLE = es ? "Camino seguro" : "Safe Walk";
  if (!state) {
    return (
      <main className="min-h-dvh pb-nav">
        <PageHeader title={TITLE} back="/safety" />
      </main>
    );
  }

  // ---- running / overdue -----------------------------------------------------
  if (walk) {
    const msg = overdue ? missedMessage(walk, position, lang) : startMessage(walk, position, lang);
    const pct = Math.min(1, Math.max(0, (now - walk.startedAt) / (walk.endsAt - walk.startedAt)));
    return (
      <main className={`min-h-dvh pb-nav transition-colors duration-500 ${overdue ? "bg-[#2a0710]" : ""}`}>
        <PageHeader title={TITLE} back="/safety" transparent={overdue} />
        <div className="mx-auto max-w-lg px-5 pt-2">
          <div className="flex flex-col items-center text-center">
            {overdue ? (
              <>
                <span className="live-badge px-2.5 py-1 text-[12px]">
                  <BellRing className="size-3.5" aria-hidden /> {es ? "Faltó el aviso" : "Check-in missed"}
                </span>
                <h2 className="mt-4 text-[30px] font-extrabold leading-tight tracking-[-0.03em]">{es ? "¿Está bien?" : "Are you OK?"}</h2>
                <p className="mt-2 max-w-xs text-[15px] leading-relaxed text-text/80">
                  {alerting
                    ? es
                      ? "Avise a sus contactos ahora. Haven no puede enviarles mensajes por usted; toque un contacto para enviar el mensaje."
                      : "Let your contacts know now. Haven can't text them for you, so tap a contact to send the message."
                    : es
                      ? "Toque “Estoy bien” para parar la alarma, o agregue más tiempo."
                      : "Tap “I'm safe” to stop the alarm, or add more time."}
                </p>
                {soundBlocked && (
                  <button
                    onClick={() => void startAlarm()}
                    className="press mt-4 inline-flex min-h-11 items-center gap-2 rounded-full bg-white/10 px-4 text-[14px] font-semibold"
                  >
                    <Volume2 className="size-4" aria-hidden /> {es ? "Sonar la alarma" : "Sound the alarm"}
                  </button>
                )}
              </>
            ) : (
              <>
                <p className="text-[13px] font-semibold uppercase tracking-[0.12em] text-muted">
                  {walk.destination ? (es ? `Caminando a ${walk.destination}` : `Walking to ${walk.destination}`) : es ? "Camino en curso" : "Walk in progress"}
                </p>
                <p className="mt-3 text-[64px] font-extrabold leading-none tracking-[-0.04em] tnum" aria-live="off">
                  {formatRemaining(remaining)}
                </p>
                <p className="mt-2 text-[14px] text-muted">{es ? "para su aviso" : "until your check-in"}</p>
                <div className="mt-5 h-2 w-full overflow-hidden rounded-full bg-surface-3" aria-hidden>
                  <div className="h-full rounded-full bg-brand transition-[width] duration-1000 ease-linear" style={{ width: `${pct * 100}%` }} />
                </div>
              </>
            )}
          </div>

          <div className="mt-7 grid gap-2.5">
            <Button size="lg" block onClick={safeTap} aria-live="polite" className={armed ? "!bg-ok/80 !text-[#03210f]" : "!bg-ok !text-[#03210f]"}>
              <Check className="size-5" strokeWidth={2.6} aria-hidden /> {armed ? (es ? "Toque otra vez para terminar" : "Tap again to end the walk") : es ? "Estoy bien" : "I'm safe"}
            </Button>
            <div className="grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={() => extend(5)}>
                <Plus className="size-4" aria-hidden /> 5 min
              </Button>
              <Button variant="secondary" onClick={() => extend(15)}>
                <Plus className="size-4" aria-hidden /> 15 min
              </Button>
            </div>
          </div>

          <section className="mt-8">
            <h3 className="mb-2.5 text-[13px] font-medium text-muted">
              {overdue ? (es ? "Avise a sus contactos" : "Alert your contacts") : es ? "Avise a alguien que va caminando" : "Let someone know you're walking"}
            </h3>
            {state.contacts.length === 0 ? (
              <p className="rounded-2xl bg-surface px-4 py-3.5 text-[14px] leading-snug text-muted">
                {es ? "No hay contactos de confianza guardados. Use Compartir para enviar el mensaje a quien quiera." : "No trusted contacts saved. Use Share to send the message to anyone."}
              </p>
            ) : (
              <ul className="divide-y divide-line overflow-hidden rounded-2xl bg-surface">
                {state.contacts.map((c) => (
                  <li key={c.id}>
                    <a href={smsHref(c.phone, msg)} className="flex min-h-[54px] items-center gap-3 px-4 py-3 active:bg-surface-2">
                      <MessageSquare className={`size-[18px] shrink-0 ${overdue ? "text-live" : "text-brand"}`} aria-hidden />
                      <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">{es ? `Mensaje a ${c.name}` : `Text ${c.name}`}</span>
                      <span className="text-[13px] text-faint tnum">{c.phone}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
            <div className="mt-2.5 grid grid-cols-2 gap-2.5">
              <Button variant="secondary" onClick={() => shareText(msg)}>
                <Share2 className="size-4" aria-hidden /> {es ? "Compartir" : "Share"}
              </Button>
              <a
                href={`tel:${EMERGENCY_NUMBER}`}
                className="press inline-flex min-h-12 items-center justify-center gap-2 rounded-control bg-live text-[15px] font-semibold text-white"
              >
                <Phone className="size-4" aria-hidden /> {es ? "Llamar al" : "Call"} {EMERGENCY_NUMBER}
              </a>
            </div>
            {!position && (
              <p className="mt-3 text-[13px] leading-snug text-faint">{es ? "Active la ubicación para incluir dónde está en el mensaje." : "Turn on location to include where you are in the message."}</p>
            )}
          </section>

          <p className="mt-8 text-center text-[12.5px] leading-relaxed text-faint">
            {es
              ? `Mantenga Haven abierto con la pantalla encendida y el volumen alto. Los teléfonos pausan los sitios en segundo plano, el iPhone no deja que los sitios vibren, y Haven no puede contactar a nadie por sí solo. Si está en peligro, llame al ${EMERGENCY_NUMBER}.`
              : `Keep Haven open with the screen on and your volume up. Phones pause websites in the background, iPhones don't let websites vibrate, and Haven can't contact anyone on its own. If you're in danger, call ${EMERGENCY_NUMBER}.`}
          </p>
        </div>
      </main>
    );
  }

  // ---- setup ------------------------------------------------------------------
  return (
    <main className="min-h-dvh pb-nav">
      <PageHeader title={TITLE} back="/safety" large />
      <div className="mx-auto max-w-lg px-5">
        <p className="text-[15px] leading-relaxed text-muted">
          {es ? "Un temporizador de aviso para caminar solo. Todo se queda en este teléfono." : "A check-in timer for walking somewhere alone. Everything stays on this phone."}
        </p>
        <ol className="mt-4 divide-y divide-line rounded-card bg-surface px-4">
          {(es
            ? [
                ["Inicie el temporizador", "Elija cuánto debería durar el camino. Toque “Estoy bien” al llegar."],
                ["Si falta el aviso", "Si el tiempo se acaba, Haven suena una alarma en este teléfono."],
                ["Avise a sus contactos", "Un mensaje con su ubicación queda listo para enviar. Usted lo envía; Haven nunca escribe a nadie por sí solo."],
              ]
            : [
                ["Start the timer", "Pick how long the walk should take. Tap “I'm safe” when you arrive."],
                ["Miss the check-in", "If the timer runs out, Haven sounds an alarm on this phone."],
                ["Alert your contacts", "A text with your location is ready to send. You send it; Haven never messages anyone on its own."],
              ]
          ).map(([t, b], i) => (
            <li key={t} className="flex gap-3.5 py-3">
              <span className="flex size-6 shrink-0 items-center justify-center rounded-full bg-surface-3 text-[12px] font-bold text-muted tnum" aria-hidden>
                {i + 1}
              </span>
              <span className="min-w-0">
                <span className="block text-[15px] font-medium tracking-[-0.01em]">{t}</span>
                <span className="block text-[13px] leading-snug text-muted">{b}</span>
              </span>
            </li>
          ))}
        </ol>

        <section className="mt-6">
          <label htmlFor="dest" className="mb-2 block text-[13px] font-medium text-muted">
            {es ? "¿A dónde va? (opcional)" : "Where are you going? (optional)"}
          </label>
          <input
            id="dest"
            value={destination}
            onChange={(e) => setDestination(e.target.value)}
            placeholder={es ? "p. ej. casa, la estación del tren" : "e.g. home, the train station"}
            maxLength={60}
            className="h-12 w-full rounded-control bg-surface-2 px-4 text-[16px] outline-none ring-brand/60 placeholder:text-faint focus:ring-2"
          />
        </section>

        <section className="mt-5">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-muted">{es ? "Avisar después de (minutos)" : "Check in after (minutes)"}</p>
            <p className="text-[12px] text-faint">{es ? "1 = prueba rápida" : "1 = quick test"}</p>
          </div>
          <Segmented
            label={es ? "Tiempo de aviso" : "Check-in time"}
            value={minutes}
            onChange={setMinutes}
            options={DURATIONS_MIN.map((m) => ({ value: m, label: String(m) }))}
          />
        </section>

        <section className="mt-7">
          <div className="mb-2 flex items-baseline justify-between">
            <p className="text-[13px] font-medium text-muted">{es ? "Contactos de confianza" : "Trusted contacts"}</p>
            <p className="text-[12px] text-faint">{es ? "Se guardan solo en este dispositivo" : "Saved on this device only"}</p>
          </div>
          {state.contacts.length > 0 && (
            <ul className="mb-2.5 divide-y divide-line overflow-hidden rounded-2xl bg-surface">
              {state.contacts.map((c) => (
                <li key={c.id} className="flex min-h-[52px] items-center gap-3 px-4 py-2.5">
                  <span className="min-w-0 flex-1 truncate text-[15.5px] font-medium">{c.name}</span>
                  <span className="text-[13px] text-faint tnum">{c.phone}</span>
                  <button
                    onClick={() => removeContact(c.id)}
                    aria-label={es ? `Quitar a ${c.name}` : `Remove ${c.name}`}
                    className="press -mr-2 flex size-10 items-center justify-center rounded-full text-faint hover:text-danger"
                  >
                    <Trash2 className="size-4" aria-hidden />
                  </button>
                </li>
              ))}
            </ul>
          )}
          {state.contacts.length < MAX_CONTACTS && (
            <div className="grid grid-cols-[1fr_1fr_auto] gap-2">
              <input
                aria-label={es ? "Nombre del contacto" : "Contact name"}
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder={es ? "Nombre" : "Name"}
                maxLength={40}
                className="h-12 min-w-0 rounded-control bg-surface-2 px-3.5 text-[16px] outline-none ring-brand/60 placeholder:text-faint focus:ring-2"
              />
              <input
                aria-label={es ? "Teléfono del contacto" : "Contact phone number"}
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder={es ? "Teléfono" : "Phone"}
                inputMode="tel"
                autoComplete="tel"
                className="h-12 min-w-0 rounded-control bg-surface-2 px-3.5 text-[16px] outline-none ring-brand/60 placeholder:text-faint focus:ring-2"
              />
              <button
                onClick={addContact}
                aria-label={es ? "Agregar contacto" : "Add contact"}
                className="press flex size-12 items-center justify-center rounded-control bg-surface-3 text-text"
              >
                <UserPlus className="size-[18px]" aria-hidden />
              </button>
            </div>
          )}
        </section>

        <Button size="lg" block onClick={start} className="mt-8 !bg-live !text-white">
          <ShieldCheck className="size-5" aria-hidden /> {es ? "Iniciar Camino seguro" : "Start Safe Walk"}
        </Button>
        <p className="mt-3 text-center text-[12.5px] leading-relaxed text-faint">
          {es
            ? `Camino seguro es gratis para todos. No reemplaza al ${EMERGENCY_NUMBER}: si está en peligro, llame de inmediato.`
            : `Safe Walk is free for everyone. It doesn't replace ${EMERGENCY_NUMBER}: if you're in danger, call right away.`}
        </p>
      </div>
    </main>
  );
}
