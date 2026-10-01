"use client";

import { useEffect, useRef, useState } from "react";
import { ArrowDown } from "lucide-react";
import { Spinner } from "./States";

const THRESHOLD = 72;

/**
 * Pull-to-refresh for scrolling lists. Wrap the page content; pulling down from
 * the top past the threshold runs `onRefresh` and shows a spinner while it runs.
 */
export function PullToRefresh({ onRefresh, children }: { onRefresh: () => Promise<unknown>; children: React.ReactNode }) {
  const [pull, setPull] = useState(0);
  const [busy, setBusy] = useState(false);
  const startY = useRef<number | null>(null);
  const busyRef = useRef(false);

  useEffect(() => {
    // Mouse-only devices never pull; keep the listeners off entirely.
    if (!window.matchMedia("(pointer: coarse)").matches) return;
    const onStart = (e: TouchEvent) => {
      if (window.scrollY <= 0 && !busyRef.current) startY.current = e.touches[0].clientY;
    };
    const onMove = (e: TouchEvent) => {
      if (startY.current == null) return;
      const dy = e.touches[0].clientY - startY.current;
      if (dy <= 0 || window.scrollY > 0) {
        setPull(0);
        return;
      }
      // Rubber-band: the further you pull, the less it moves.
      setPull(Math.min(120, dy * 0.55));
    };
    const onEnd = () => {
      if (startY.current == null) return;
      startY.current = null;
      setPull((p) => {
        if (p >= THRESHOLD * 0.55 && !busyRef.current) {
          busyRef.current = true;
          setBusy(true);
          navigator.vibrate?.(10);
          void onRefresh().finally(() => {
            busyRef.current = false;
            setBusy(false);
          });
        }
        return 0;
      });
    };
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  const armed = pull >= THRESHOLD * 0.55;
  const show = busy || pull > 4;
  return (
    <div style={{ transform: `translateY(${busy ? 44 : pull}px)`, transition: pull ? "none" : "transform 320ms var(--ease-spring)" }}>
      <div
        className="pointer-events-none absolute inset-x-0 flex justify-center"
        style={{ top: -40, opacity: show ? 1 : 0, transition: "opacity 150ms" }}
        aria-live="polite"
      >
        <span className="glass flex size-9 items-center justify-center rounded-full text-text">
          {busy ? (
            <Spinner className="size-[18px]" />
          ) : (
            <ArrowDown
              className="size-[18px] transition-transform duration-200"
              style={{ transform: armed ? "rotate(180deg)" : "none" }}
              aria-hidden
            />
          )}
          <span className="sr-only">{busy ? "Refreshing" : armed ? "Release to refresh" : "Pull to refresh"}</span>
        </span>
      </div>
      {children}
    </div>
  );
}
