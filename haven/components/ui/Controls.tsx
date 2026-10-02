"use client";

import Link from "next/link";
import { ChevronRight, Lock } from "lucide-react";

export function Chip({
  active,
  locked,
  children,
  className = "",
  ...rest
}: { active?: boolean; locked?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-pressed={active}
      className={`press inline-flex h-11 shrink-0 items-center gap-1.5 rounded-full px-4 text-[14px] font-medium disabled:opacity-45 ${
        active ? "bg-text text-bg" : "bg-surface-2 text-text/90 hover:bg-surface-3"
      } ${className}`}
      {...rest}
    >
      {children}
      {locked && <Lock className="size-3 opacity-70" aria-label="Lifetime feature" />}
    </button>
  );
}

/** iOS-style segmented control. */
export function Segmented<T extends string | number>({
  options,
  value,
  onChange,
  label,
  disabled,
}: {
  options: { value: T; label: string; locked?: boolean }[];
  value: T;
  onChange: (v: T) => void;
  label: string;
  disabled?: boolean;
}) {
  return (
    <div role="radiogroup" aria-label={label} className={`flex rounded-control bg-surface-2 p-[3px] ${disabled ? "opacity-45" : ""}`}>
      {options.map((o) => {
        const on = o.value === value;
        return (
          <button
            key={String(o.value)}
            role="radio"
            aria-checked={on}
            disabled={disabled || o.locked}
            onClick={() => onChange(o.value)}
            className={`relative flex min-h-11 flex-1 items-center justify-center gap-1 rounded-[10px] text-[13px] font-semibold transition-all duration-200 ${
              on ? "bg-surface-3 text-text shadow-[0_1px_3px_rgba(0,0,0,0.4)]" : "text-muted hover:text-text"
            } ${o.locked ? "cursor-not-allowed text-faint hover:text-faint" : ""}`}
          >
            {o.label}
            {o.locked && <Lock className="size-3" aria-label="Lifetime" />}
          </button>
        );
      })}
    </div>
  );
}

export function Toggle({
  checked,
  onChange,
  label,
  description,
  disabled,
  locked,
  idle,
  note,
}: {
  checked: boolean;
  onChange: (v: boolean) => void;
  label: string;
  description?: string;
  disabled?: boolean;
  locked?: boolean;
  /** Switched on, but not doing anything yet: shown amber, never green. */
  idle?: boolean;
  /** Why it's idle, in place of the description. */
  note?: string;
}) {
  const waiting = Boolean(idle) && checked;
  return (
    <label className={`flex min-h-[52px] cursor-pointer items-center gap-4 py-3 ${disabled ? "opacity-45" : ""}`}>
      <span className="flex-1">
        <span className="flex items-center gap-1.5 text-[16px] tracking-[-0.01em]">
          {label}
          {locked && <Lock className="size-3.5 text-gold" aria-label="Lifetime feature" />}
        </span>
        {waiting && note ? (
          <span className="mt-0.5 block text-[13px] leading-snug text-warn">{note}</span>
        ) : (
          description && <span className="mt-0.5 block text-[13px] leading-snug text-muted">{description}</span>
        )}
      </span>
      <input
        type="checkbox"
        role="switch"
        className="peer sr-only"
        checked={checked}
        disabled={disabled}
        onChange={(e) => onChange(e.target.checked)}
      />
      <span
        aria-hidden
        className={`relative h-[31px] w-[51px] shrink-0 rounded-full bg-surface-3 transition-colors duration-200 ${waiting ? "peer-checked:bg-warn/70" : "peer-checked:bg-ok"} peer-focus-visible:outline-2 peer-focus-visible:outline-offset-2 peer-focus-visible:outline-brand after:absolute after:left-[2px] after:top-[2px] after:size-[27px] after:rounded-full after:bg-white after:shadow-[0_2px_6px_rgba(0,0,0,0.35)] after:transition-transform after:duration-300 after:ease-[var(--ease-spring)] peer-checked:after:translate-x-5`}
      />
    </label>
  );
}

/** Inset grouped list, like a settings screen. Rows are separated by hairlines. */
export function Group({
  title,
  footer,
  action,
  children,
  className = "",
  id,
}: {
  title?: string;
  footer?: React.ReactNode;
  action?: React.ReactNode;
  children: React.ReactNode;
  className?: string;
  id?: string;
}) {
  return (
    <section id={id} className={`mt-7 scroll-mt-24 ${className}`}>
      {(title || action) && (
        <div className="mb-2 flex min-h-6 items-center justify-between px-4">
          {title && <h2 className="t-section">{title}</h2>}
          {action}
        </div>
      )}
      <div className="divide-y divide-line overflow-hidden rounded-card bg-surface px-4">{children}</div>
      {footer && <div className="px-4 pt-2 text-[13px] leading-snug text-faint">{footer}</div>}
    </section>
  );
}

export function Row({
  icon,
  title,
  detail,
  trailing,
  href,
  onClick,
  tone,
}: {
  icon?: React.ReactNode;
  title: React.ReactNode;
  detail?: React.ReactNode;
  trailing?: React.ReactNode;
  href?: string;
  onClick?: () => void;
  tone?: "danger";
}) {
  const body = (
    <>
      {icon && (
        <span className={`flex size-[30px] shrink-0 items-center justify-center ${tone === "danger" ? "text-danger" : "text-muted"}`} aria-hidden>
          {icon}
        </span>
      )}
      <span className="min-w-0 flex-1">
        {/* Two lines, not a cut-off one: Spanish runs a third longer than English. */}
        <span className={`line-clamp-2 text-[16px] leading-snug tracking-[-0.01em] ${tone === "danger" ? "text-danger" : ""}`}>{title}</span>
        {detail && <span className="mt-0.5 line-clamp-2 text-[13px] leading-snug text-muted">{detail}</span>}
      </span>
      {trailing}
      {href && <ChevronRight className="size-[18px] shrink-0 text-faint" aria-hidden />}
    </>
  );
  const cls = "flex min-h-[52px] w-full items-center gap-3 py-2.5 text-left";
  if (href) return <Link href={href} prefetch={href.startsWith("/incidents/") ? false : undefined} className={`${cls} active:opacity-60`}>{body}</Link>;
  if (onClick) return <button onClick={onClick} className={`${cls} active:opacity-60`}>{body}</button>;
  return <div className={cls}>{body}</div>;
}
