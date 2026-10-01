"use client";

// Which rows just arrived (for a brief highlight), and how many came in while
// the person was scrolled down (for a "3 new" pill). Nothing counts as new
// on the first answer: that's the list, not news.

import { useEffect, useState, useSyncExternalStore } from "react";

interface State<T> {
  items: readonly T[] | null;
  known: ReadonlySet<string>;
  arrived: ReadonlySet<string>;
  /** Bumps on every batch so the clearing timer restarts. */
  gen: number;
  pending: number;
}

const NONE: ReadonlySet<string> = new Set();
const HIGHLIGHT_MS = 6_000;

export function useArrivals<T extends { id: string }>(
  items: readonly T[],
  opts: { scrolled: boolean; max?: number } = { scrolled: false },
): { arrived: ReadonlySet<string>; pending: number } {
  const [state, setState] = useState<State<T>>({ items: null, known: NONE, arrived: NONE, gen: 0, pending: 0 });

  // Derived from the incoming list during render (React's "adjusting state
  // when a prop changes" pattern), so there is no setState in an effect.
  // (An empty list is the same empty list, whatever its identity.)
  if (state.items !== items && !(items.length === 0 && state.items?.length === 0)) {
    const ids = new Set(items.map((i) => i.id));
    let next: State<T>;
    if (!state.items?.length || items.length === 0) {
      // The first real answer is the baseline, not a batch of news.
      next = { ...state, items, known: ids };
    } else {
      const fresh = items.filter((i) => !state.known.has(i.id)).map((i) => i.id);
      // A wholesale change (new area, new filter) is a different list, not news.
      const news = fresh.length > 0 && fresh.length <= (opts.max ?? 12);
      next = {
        items,
        known: ids,
        arrived: news ? new Set(fresh) : state.arrived,
        gen: news ? state.gen + 1 : state.gen,
        pending: news && opts.scrolled ? state.pending + fresh.length : state.pending,
      };
    }
    setState(next);
  }
  // Back at the top: the pill has done its job.
  if (!opts.scrolled && state.pending) setState((s) => ({ ...s, pending: 0 }));

  useEffect(() => {
    if (!state.gen) return;
    const id = setTimeout(() => setState((s) => (s.gen === state.gen ? { ...s, arrived: NONE } : s)), HIGHLIGHT_MS);
    return () => clearTimeout(id);
  }, [state.gen]);

  return { arrived: state.arrived, pending: state.pending };
}

const scrollListeners = new Set<() => void>();
let scrollBound = false;
function bindScroll() {
  if (scrollBound) return;
  scrollBound = true;
  let raf = 0;
  const onScroll = () => {
    if (raf) return;
    raf = requestAnimationFrame(() => {
      raf = 0;
      scrollListeners.forEach((l) => l());
    });
  };
  window.addEventListener("scroll", onScroll, { passive: true });
}

/** True while the window is scrolled past `px` (false on the server). */
export function useScrolledPast(px: number): boolean {
  return useSyncExternalStore(
    (cb) => {
      bindScroll();
      scrollListeners.add(cb);
      return () => scrollListeners.delete(cb);
    },
    () => window.scrollY > px,
    () => false,
  );
}
