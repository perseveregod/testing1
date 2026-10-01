"use client";

import { CircleAlert, RefreshCw } from "lucide-react";
import { useT } from "@/lib/client/lang";

export function Spinner({ className = "size-6" }: { className?: string }) {
  return (
    <svg className={`animate-spin ${className}`} viewBox="0 0 24 24" fill="none" aria-hidden>
      <circle cx="12" cy="12" r="9" stroke="currentColor" strokeOpacity="0.2" strokeWidth="2.5" />
      <path d="M21 12a9 9 0 0 0-9-9" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" />
    </svg>
  );
}

export function Skeleton({ className = "" }: { className?: string }) {
  return <div className={`haven-shimmer rounded-lg ${className}`} aria-hidden />;
}

/** Placeholder matching a list row, so content doesn't jump when it loads. */
export function RowSkeleton() {
  return (
    <div className="flex gap-3 py-4" aria-hidden>
      <Skeleton className="size-9 shrink-0 rounded-full" />
      <div className="flex-1 space-y-2 pt-0.5">
        <Skeleton className="h-3.5 w-2/5" />
        <Skeleton className="h-3 w-3/5" />
        <Skeleton className="h-3 w-4/5" />
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
}: {
  icon: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
}) {
  return (
    <div className="haven-rise flex flex-col items-center px-8 py-14 text-center">
      <div className="mb-4 text-faint">{icon}</div>
      <h3 className="text-[17px] font-semibold tracking-[-0.01em]">{title}</h3>
      {body && <p className="mt-1.5 max-w-[280px] text-[15px] leading-relaxed text-muted">{body}</p>}
      {action && <div className="mt-6">{action}</div>}
    </div>
  );
}

export function ErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  const { t } = useT();
  return (
    <div role="alert" className="haven-rise flex flex-col items-center px-8 py-12 text-center">
      <CircleAlert className="mb-3 size-7 text-faint" strokeWidth={1.75} aria-hidden />
      <p className="max-w-[280px] text-[15px] text-muted">{message}</p>
      {onRetry && (
        <button
          onClick={onRetry}
          className="press mt-5 inline-flex min-h-11 items-center gap-2 rounded-full bg-surface-3 px-4 text-[14px] font-semibold"
        >
          <RefreshCw className="size-4" aria-hidden /> {t("common.tryAgain")}
        </button>
      )}
    </div>
  );
}
