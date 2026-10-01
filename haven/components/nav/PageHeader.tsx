"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { addTransitionType, startTransition } from "react";
import { ChevronLeft } from "lucide-react";

/**
 * Native-style header. With `large`, a big title sits in the content and the
 * compact bar's title fades in once it scrolls away. Sub-content (filters,
 * tabs) stays pinned under the bar.
 */
export function PageHeader({
  title,
  back,
  action,
  sub,
  large,
  transparent,
}: {
  title: string;
  back?: boolean | string;
  action?: React.ReactNode;
  sub?: React.ReactNode;
  large?: boolean;
  /** Sits over a hero; the bar only gains a background once content scrolls under it. */
  transparent?: boolean;
}) {
  const router = useRouter();
  const sentinel = useRef<HTMLDivElement>(null);
  const [scrolled, setScrolled] = useState(!large && !transparent);

  useEffect(() => {
    if (large && sentinel.current) {
      const io = new IntersectionObserver(
        ([e]) => setScrolled(!e!.isIntersecting),
        { rootMargin: "-56px 0px 0px 0px" },
      );
      io.observe(sentinel.current);
      return () => io.disconnect();
    }
    if (transparent) {
      const onScroll = () => setScrolled(window.scrollY > 160);
      onScroll();
      window.addEventListener("scroll", onScroll, { passive: true });
      return () => window.removeEventListener("scroll", onScroll);
    }
  }, [large, transparent]);

  return (
    <>
      <header
        className={`sticky top-0 z-30 transition-[background-color,box-shadow] duration-300 ${
          scrolled
            ? `glass-bar ${large && sub ? "!shadow-none" : ""}`
            : "bg-transparent"
        }`}
        style={{ paddingTop: "var(--safe-top)" }}
      >
        <div className="relative mx-auto flex h-12 max-w-lg items-center px-2">
          {back ? (
            <button
              onClick={() => {
                // Slide back out the way we came in.
                startTransition(() => {
                  addTransitionType("nav-back");
                  if (typeof back === "string") router.push(back);
                  else if (window.history.length > 1) router.back();
                  else router.push("/");
                });
              }}
              aria-label="Back"
              className={`press z-10 inline-flex items-center justify-center rounded-full text-text ${transparent && !scrolled ? "glass size-10" : "size-11 hover:bg-surface-2"}`}
            >
              <ChevronLeft
                className="size-[24px]"
                strokeWidth={2.2}
                aria-hidden
              />
            </button>
          ) : (
            <span className="size-11" />
          )}
          <h1
            aria-hidden={large ? !scrolled : undefined}
            className={`pointer-events-none absolute inset-x-16 truncate text-center text-[17px] font-semibold tracking-[-0.015em] transition-all duration-300 ${
              scrolled ? "translate-y-0 opacity-100" : "translate-y-1 opacity-0"
            }`}
          >
            {title}
          </h1>
          <div className="z-10 ml-auto flex items-center">{action}</div>
        </div>
        {sub && !large && <div className="mx-auto max-w-lg">{sub}</div>}
      </header>
      {large && (
        <>
          <div className="mx-auto max-w-lg px-5 pb-2 pt-1">
            <p
              className="text-[32px] font-bold leading-tight tracking-[-0.03em]"
              role="heading"
              aria-level={1}
            >
              {title}
            </p>
            <div ref={sentinel} className="h-px" aria-hidden />
          </div>
          {sub && (
            <div
              className={`sticky z-20 transition-[background-color,box-shadow] duration-300 ${
                scrolled ? "glass-bar" : "bg-transparent"
              }`}
              style={{ top: "calc(var(--safe-top) + 48px)" }}
            >
              <div className="mx-auto max-w-lg">{sub}</div>
            </div>
          )}
        </>
      )}
    </>
  );
}
