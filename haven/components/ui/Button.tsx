import Link from "next/link";
import { forwardRef } from "react";
import { Spinner } from "./States";

type Variant = "primary" | "secondary" | "ghost" | "danger" | "gold" | "accent";
type Size = "md" | "lg" | "sm";

// Primary actions are light-on-dark; color is reserved for meaning.
const VARIANTS: Record<Variant, string> = {
  primary: "bg-text text-bg hover:bg-white",
  secondary: "bg-surface-3 text-text hover:bg-[#2c2f36]",
  ghost: "bg-transparent text-text hover:bg-surface-2",
  danger: "bg-danger/12 text-danger hover:bg-danger/20",
  gold: "bg-gold text-[#241a05] hover:brightness-105",
  accent: "bg-brand text-brand-ink hover:brightness-105",
};

// Every size keeps a ≥44px touch target.
const SIZES: Record<Size, string> = {
  sm: "min-h-11 px-4 text-[14px] rounded-full gap-1.5",
  md: "min-h-12 px-5 text-[15px] rounded-[14px] gap-2",
  lg: "min-h-[54px] px-6 text-[16px] rounded-2xl gap-2",
};

export function buttonClass(variant: Variant = "primary", size: Size = "md", extra = "") {
  return `press inline-flex items-center justify-center font-semibold tracking-[-0.01em] select-none disabled:opacity-40 disabled:pointer-events-none ${VARIANTS[variant]} ${SIZES[size]} ${extra}`;
}

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant;
  size?: Size;
  loading?: boolean;
  block?: boolean;
}

export const Button = forwardRef<HTMLButtonElement, ButtonProps>(function Button(
  { variant = "primary", size = "md", loading, block, className = "", children, disabled, ...rest },
  ref,
) {
  return (
    <button
      ref={ref}
      className={buttonClass(variant, size, `${block ? "w-full" : ""} ${className}`)}
      disabled={disabled || loading}
      aria-busy={loading || undefined}
      {...rest}
    >
      {loading ? <Spinner className="size-5" /> : children}
    </button>
  );
});

export function ButtonLink({
  href,
  variant = "primary",
  size = "md",
  block,
  className = "",
  children,
  ...rest
}: { href: string; variant?: Variant; size?: Size; block?: boolean } & Omit<
  React.ComponentProps<typeof Link>,
  "href"
>) {
  return (
    <Link href={href} className={buttonClass(variant, size, `${block ? "w-full" : ""} ${className}`)} {...rest}>
      {children}
    </Link>
  );
}

/** Round floating control used over the map and in headers. */
export function IconButton({
  label,
  className = "",
  children,
  ...rest
}: { label: string } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      aria-label={label}
      title={label}
      className={`press glass inline-flex size-12 items-center justify-center rounded-full text-text ${className}`}
      {...rest}
    >
      {children}
    </button>
  );
}

/** Vertical icon + label action, like a native action row. */
export function ActionButton({
  icon,
  label,
  active,
  className = "",
  ...rest
}: { icon: React.ReactNode; label: string; active?: boolean } & React.ButtonHTMLAttributes<HTMLButtonElement>) {
  return (
    <button
      className={`press flex min-h-[64px] flex-col items-center justify-center gap-1.5 rounded-2xl text-[12px] font-medium disabled:opacity-40 ${
        active ? "bg-brand/12 text-brand" : "bg-surface-2 text-text hover:bg-surface-3"
      } ${className}`}
      {...rest}
    >
      <span aria-hidden>{icon}</span>
      {label}
    </button>
  );
}
