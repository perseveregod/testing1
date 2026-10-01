"use client";

import { createContext, useCallback, useContext, useMemo, useRef, useState } from "react";
import { CheckCircle2, CircleAlert, Info } from "lucide-react";

type Tone = "success" | "error" | "info";
interface Toast {
  id: number;
  message: string;
  tone: Tone;
  leaving?: boolean;
}

const Ctx = createContext<((message: string, tone?: Tone) => void) | null>(null);

export function ToastProvider({ children }: { children: React.ReactNode }) {
  const [toasts, setToasts] = useState<Toast[]>([]);
  const next = useRef(1);

  const show = useCallback((message: string, tone: Tone = "info") => {
    const id = next.current++;
    setToasts((t) => [...t.slice(-1), { id, message, tone }]);
    setTimeout(() => setToasts((t) => t.map((x) => (x.id === id ? { ...x, leaving: true } : x))), 3000);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), 3250);
  }, []);

  const value = useMemo(() => show, [show]);
  return (
    <Ctx.Provider value={value}>
      {children}
      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 top-0 z-[100] flex flex-col items-center gap-2 px-4"
        style={{ paddingTop: "calc(var(--safe-top) + 10px)" }}
      >
        {toasts.map((t) => {
          const Icon = t.tone === "success" ? CheckCircle2 : t.tone === "error" ? CircleAlert : Info;
          const color = t.tone === "success" ? "text-ok" : t.tone === "error" ? "text-danger" : "text-muted";
          return (
            <div
              key={t.id}
              role={t.tone === "error" ? "alert" : "status"}
              className={`glass pointer-events-auto flex max-w-sm items-center gap-2.5 rounded-full py-2.5 pl-3.5 pr-4 text-[14px] font-medium ${
                t.leaving ? "haven-fade-out" : "haven-rise"
              }`}
            >
              <Icon className={`size-[18px] shrink-0 ${color}`} aria-hidden />
              <span>{t.message}</span>
            </div>
          );
        })}
      </div>
    </Ctx.Provider>
  );
}

export function useToast() {
  const v = useContext(Ctx);
  if (!v) throw new Error("useToast must be used inside ToastProvider");
  return v;
}
