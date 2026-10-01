import { createElement, type ReactElement } from "react";
import { ICON_GRADIENTS, iconBackground, iconForeground, type Shape } from "@/lib/brand/icon";

// Plain element arrays, not components: the PNG renderer (Satori) only
// accepts intrinsic elements inside <svg>, and the DOM is happy either way.

/** Gradient defs as React elements. */
export function iconDefs(): ReactElement[] {
  return ICON_GRADIENTS.map((g) => {
    const stops = g.stops.map(([o, c, a]) => <stop key={o} offset={o} stopColor={c} stopOpacity={a} />);
    return g.kind === "linear" ? (
      <linearGradient key={g.id} id={g.id} x1="0" y1="0" x2="0" y2="1">
        {stops}
      </linearGradient>
    ) : (
      <radialGradient key={g.id} id={g.id} cx={g.cx} cy={g.cy} r={g.r}>
        {stops}
      </radialGradient>
    );
  });
}

/** Shapes as React SVG elements. */
function elements(shapes: Shape[], prefix: string): ReactElement[] {
  return shapes.map((sh, i) => {
    // Hyphenated SVG attributes become camelCase in React.
    const attrs: Record<string, string | number> = {};
    for (const [k, v] of Object.entries(sh.attrs)) {
      attrs[k.replace(/-([a-z])/g, (_, c: string) => c.toUpperCase())] = v;
    }
    return createElement(sh.tag, { key: `${prefix}${i}`, ...attrs });
  });
}

/** The whole icon's shapes as React SVG elements. */
export function iconElements(): ReactElement[] {
  return [...elements(iconBackground(), "b"), ...elements(iconForeground(), "f")];
}

/**
 * The Haven app icon for the PNG renderer (home-screen icons, Apple touch
 * icon). `maskable` keeps the city inside Android's safe zone: the sky stays
 * full-bleed and the city shrinks toward the middle.
 */
export function AppIcon({ size, maskable = false }: { size: number; maskable?: boolean }) {
  const pad = maskable ? 0.12 : 0;
  return (
    <div style={{ width: size, height: size, display: "flex", background: "#0d1a3a" }}>
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>{iconDefs()}</defs>
        {elements(iconBackground(), "b")}
        <g transform={maskable ? `translate(${64 * pad} ${64 * pad}) scale(${1 - 2 * pad})` : undefined}>{elements(iconForeground(), "f")}</g>
      </svg>
    </div>
  );
}
