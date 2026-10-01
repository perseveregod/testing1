"use client";

import { usePathname } from "next/navigation";
import { MapScreen } from "@/components/map/MapScreen";

/**
 * The map is mounted once, under every tab, and stays alive while you browse
 * the others: switching back is instant and the camera is where you left it.
 * Off the map tab it is hidden (after the page above has faded in) and inert.
 */
export function MapHost() {
  const onMap = usePathname() === "/";
  return (
    <div className="map-host" data-active={onMap ? "true" : "false"} inert={!onMap}>
      <MapScreen />
    </div>
  );
}
