"use client";

import { useSyncExternalStore } from "react";
import { WifiOff } from "lucide-react";
import { useT } from "@/lib/client/lang";

function subscribe(cb: () => void) {
  window.addEventListener("online", cb);
  window.addEventListener("offline", cb);
  return () => {
    window.removeEventListener("online", cb);
    window.removeEventListener("offline", cb);
  };
}

/**
 * Says so when the connection is gone. Lists keep what they last loaded, so
 * without this an old map looks current until its "checked" time goes stale.
 */
export function OfflineNotice() {
  const offline = useSyncExternalStore(
    subscribe,
    () => !navigator.onLine,
    () => false,
  );
  const { t } = useT();
  if (!offline) return null;
  return (
    <div className="pointer-events-none fixed inset-x-0 z-[70] flex justify-center px-4" style={{ top: "calc(var(--safe-top) + 6px)" }}>
      {/* Narrow enough to leave the back button and the header action in view. */}
      <p role="status" className="flex min-h-9 max-w-[calc(100%-96px)] items-center gap-2 rounded-full bg-warn px-3.5 py-1.5 text-[13px] font-semibold leading-tight text-[#241a05] shadow-lg">
        <WifiOff className="size-4 shrink-0" aria-hidden />
        {t("net.offline")}
      </p>
    </div>
  );
}
