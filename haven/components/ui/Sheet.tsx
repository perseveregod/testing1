"use client";

import { useCallback, useEffect, useId, useRef, useState } from "react";
import { createPortal } from "react-dom";

// Bottom sheet with native-feeling motion: slides in, animates out, and can
// be dragged down to dismiss. Modal dialog semantics, Escape/backdrop close,
// focus moved in and restored, padding for the home indicator.

/** Keeps content mounted while it animates out. */
export function usePresence(open: boolean, exitMs = 220) {
  const [mounted, setMounted] = useState(open);
  const [closing, setClosing] = useState(false);
  useEffect(() => {
    if (open) {
      queueMicrotask(() => {
        setMounted(true);
        setClosing(false);
      });
      return;
    }
    if (!mounted) return;
    queueMicrotask(() => setClosing(true));
    const t = setTimeout(() => {
      setMounted(false);
      setClosing(false);
    }, exitMs);
    return () => clearTimeout(t);
  }, [open, mounted, exitMs]);
  return { mounted, closing };
}

/** Pointer-drag-to-dismiss for a sheet panel. Returns handlers and the live offset. */
export function useDragDismiss(onDismiss: () => void) {
  const start = useRef<number | null>(null);
  const [dy, setDy] = useState(0);
  const onPointerDown = useCallback((e: React.PointerEvent) => {
    start.current = e.clientY;
    (e.currentTarget as HTMLElement).setPointerCapture(e.pointerId);
  }, []);
  const onPointerMove = useCallback((e: React.PointerEvent) => {
    if (start.current == null) return;
    setDy(Math.max(0, e.clientY - start.current));
  }, []);
  const onPointerUp = useCallback(() => {
    if (start.current == null) return;
    start.current = null;
    setDy((d) => {
      if (d > 90) onDismiss();
      return 0;
    });
  }, [onDismiss]);
  return {
    dy,
    handlers: {
      onPointerDown,
      onPointerMove,
      onPointerUp,
      onPointerCancel: onPointerUp,
    },
  };
}

export function Sheet({
  open,
  onClose,
  title,
  children,
  footer,
  className = "",
}: {
  open: boolean;
  onClose: () => void;
  title?: string;
  children: React.ReactNode;
  footer?: React.ReactNode;
  className?: string;
}) {
  const panel = useRef<HTMLDivElement>(null);
  const titleId = useId();
  const { mounted, closing } = usePresence(open);
  const { dy, handlers } = useDragDismiss(onClose);

  useEffect(() => {
    if (!open) return;
    const prev = document.activeElement as HTMLElement | null;
    panel.current?.focus({ preventScroll: true });
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose();
    window.addEventListener("keydown", onKey);
    const overflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    return () => {
      window.removeEventListener("keydown", onKey);
      document.body.style.overflow = overflow;
      prev?.focus?.({ preventScroll: true });
    };
  }, [open, onClose]);

  if (!mounted) return null;
  return createPortal(
    <div className="fixed inset-0 z-[60] flex items-end justify-center">
      <button
        aria-label="Close"
        tabIndex={-1}
        onClick={onClose}
        className={`absolute inset-0 bg-black/60 backdrop-blur-[2px] ${closing ? "haven-fade-out" : "haven-fade-in"}`}
      />
      <div
        ref={panel}
        role="dialog"
        aria-modal
        aria-labelledby={title ? titleId : undefined}
        tabIndex={-1}
        className={`relative w-full max-w-lg rounded-t-[24px] glass-sheet outline-none ${
          closing ? "haven-sheet-out" : "haven-sheet-in"
        } ${className}`}
        style={{
          paddingBottom: "calc(var(--safe-bottom) + 12px)",
          maxHeight: "calc(100dvh - var(--safe-top) - 16px)",
          transform: dy ? `translateY(${dy}px)` : undefined,
          transition: dy ? "none" : "transform 260ms var(--ease-out)",
        }}
      >
        <div
          {...handlers}
          className="cursor-grab touch-none select-none active:cursor-grabbing"
        >
          <div className="flex justify-center pb-1 pt-2.5" aria-hidden>
            <div className="h-[5px] w-9 rounded-full bg-white/15" />
          </div>
          {title && (
            <h2
              id={titleId}
              className="px-5 pb-3 pt-2 text-[19px] font-semibold tracking-[-0.015em]"
            >
              {title}
            </h2>
          )}
        </div>
        <div className="max-h-[68dvh] overflow-y-auto overscroll-contain px-5 pb-2">
          {children}
        </div>
        {footer && <div className="px-5 pt-3">{footer}</div>}
      </div>
    </div>,
    document.body,
  );
}
