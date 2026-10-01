"use client";

import { useEffect, useState } from "react";
import { preconnect } from "react-dom";
import { usePathname } from "next/navigation";
import { MapScreen } from "@/components/map/MapScreen";
import { MAP_STYLE_URL } from "@/lib/client/defaults";

/**
 * The map is mounted once, under every tab, and stays alive while you browse
 * the others: switching back is instant and the camera is where you left it.
 * Off the map tab it is hidden (after the page above has faded in) and inert.
 *
 * Opening on another tab doesn't pay for the map first: it mounts once that
 * tab has painted and the browser is idle, or the moment you switch to it.
 */
export function MapHost() {
  const onMap = usePathname() === "/";
  // The tile server handshake starts with the page, not with the first tile.
  preconnect(new URL(MAP_STYLE_URL).origin, { crossOrigin: "anonymous" });
  const [idle, setIdle] = useState(false);
  // Once mounted, stays mounted (the whole point is keeping the map alive):
  // `idle` latches a tick after the map tab is first shown.
  const mounted = onMap || idle;
  useEffect(() => {
    if (idle) return;
    const show = () => setIdle(true);
    if (onMap) {
      const id = setTimeout(show, 0);
      return () => clearTimeout(id);
    }
    // Safari has no requestIdleCallback; a short timer is the same idea.
    const w = window as Window & { requestIdleCallback?: typeof requestIdleCallback; cancelIdleCallback?: typeof cancelIdleCallback };
    if (typeof w.requestIdleCallback === "function") {
      const id = w.requestIdleCallback(show, { timeout: 2500 });
      return () => w.cancelIdleCallback?.(id);
    }
    const id = setTimeout(show, 1200);
    return () => clearTimeout(id);
  }, [idle, onMap]);
  return (
    <div className="map-host" data-active={onMap ? "true" : "false"} inert={!onMap}>
      {mounted && <MapScreen active={onMap} />}
    </div>
  );
}
