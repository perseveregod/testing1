// The Haven app icon: a Houston night sky. Two soft clouds, the downtown
// silhouette (Heritage Plaza's stepped crown, Wells Fargo Plaza, the Chase
// Tower's cut corner, the Bank of America gables, Pennzoil Place's slanted
// pair, CenterPoint's spire) and, above the city, Haven's dot: the same
// glowing point that marks you on the map.
//
// One geometry, two renderers: React elements for the app and for the PNG
// renderer (ImageResponse), and a plain SVG string for app/icon.svg.

export type Shape = { tag: "rect" | "circle" | "path" | "polygon"; attrs: Record<string, string | number> };

export const ICON_SIZE = 64;

const SKY_TOP = "#1a2d5a";
const SKY_BOTTOM = "#0b1020";
const CLOUD = "#d6e1f6";
const CITY = "#33467a";
const CITY_BACK = "#243359";
const GROUND = "#0b0e14";
const WINDOW = "#ffd27a";
const DOT = "#4a90ff";

function rect(x: number, y: number, w: number, h: number, extra: Record<string, string | number> = {}): Shape {
  return { tag: "rect", attrs: { x, y, width: w, height: h, ...extra } };
}
function poly(points: [number, number][], extra: Record<string, string | number> = {}): Shape {
  return { tag: "polygon", attrs: { points: points.map(([x, y]) => `${x},${y}`).join(" "), ...extra } };
}
function circle(cx: number, cy: number, r: number, extra: Record<string, string | number> = {}): Shape {
  return { tag: "circle", attrs: { cx, cy, r, ...extra } };
}

/** Gradients, as data: both renderers build them from this. */
export const ICON_GRADIENTS = [
  { id: "hv-sky", kind: "linear" as const, stops: [[0, SKY_TOP, 1], [1, SKY_BOTTOM, 1]] as const },
  { id: "hv-glow", kind: "radial" as const, cx: 0.5, cy: 1, r: 0.75, stops: [[0, "#ff9d3f", 0.3], [1, "#ff9d3f", 0]] as const },
  { id: "hv-halo", kind: "radial" as const, cx: 0.5, cy: 0.5, r: 0.5, stops: [[0, DOT, 0.75], [1, DOT, 0]] as const },
];

/** Gradient definitions as SVG markup (for the static file). */
export const ICON_DEFS = ICON_GRADIENTS.map((g) => {
  const stops = g.stops.map(([o, c, a]) => `<stop offset="${o}" stop-color="${c}" stop-opacity="${a}"/>`).join("");
  return g.kind === "linear"
    ? `<linearGradient id="${g.id}" x1="0" y1="0" x2="0" y2="1">${stops}</linearGradient>`
    : `<radialGradient id="${g.id}" cx="${g.cx}" cy="${g.cy}" r="${g.r}">${stops}</radialGradient>`;
}).join("");

const G = 60; // ground line

/** The sky: full-bleed, also behind a maskable icon's safe zone. */
export function iconBackground(): Shape[] {
  return [
    rect(0, 0, 64, 64, { fill: "url(#hv-sky)" }),
    // Warm city glow along the horizon.
    rect(0, 28, 64, 36, { fill: "url(#hv-glow)" }),
  ];
}

/** Everything in a 64 × 64 box: sky, then the city. */
export function iconShapes(): Shape[] {
  return [...iconBackground(), ...iconForeground()];
}

/** Clouds, Haven's dot, downtown and the ground (what a maskable icon scales down). */
export function iconForeground(): Shape[] {
  const s: Shape[] = [];

  // Clouds: a few circles over a rounded base read as a cloud at any size.
  const cloud = (x: number, y: number, k: number) => {
    s.push(circle(x + 5 * k, y, 5 * k, { fill: CLOUD }));
    s.push(circle(x + 11 * k, y - 3 * k, 6.5 * k, { fill: CLOUD }));
    s.push(circle(x + 17 * k, y, 5 * k, { fill: CLOUD }));
    s.push(rect(x, y, 22 * k, 4.5 * k, { rx: 2.2 * k, fill: CLOUD }));
  };
  cloud(6, 15, 1);
  cloud(40, 24, 0.7);

  // Haven's dot above downtown.
  s.push(circle(32, 25, 10, { fill: "url(#hv-halo)" }));
  s.push(circle(32, 25, 4.6, { fill: "none", stroke: "#ffffff", "stroke-opacity": 0.7, "stroke-width": 1.6 }));
  s.push(circle(32, 25, 2.6, { fill: "#ffffff" }));

  // Back row: lower blocks between the towers.
  for (const [x, w, top] of [[11, 2.5, 48], [19, 2.5, 47], [28, 2.5, 46], [37, 2.5, 47], [48, 2.5, 47], [55, 2.5, 49]] as const) {
    s.push(rect(x, top, w, G - top, { fill: CITY_BACK }));
  }
  // Heritage Plaza: slab, stepped crown.
  s.push(rect(4, 44, 7, G - 44, { fill: CITY }));
  s.push(rect(5.5, 42, 4, 2, { fill: CITY }));
  s.push(rect(6.5, 40, 2, 2, { fill: CITY }));
  // Wells Fargo Plaza: rounded shoulders.
  s.push(poly([[13, G], [13, 38.5], [14.5, 37], [17.5, 37], [19, 38.5], [19, G]], { fill: CITY }));
  // Chase Tower: tallest, cut corner.
  s.push(poly([[21, G], [21, 34], [26, 34], [28, 36.5], [28, G]], { fill: CITY }));
  // Bank of America Center: three stepped sections with pointed gables.
  for (const [x, top] of [[30, 42], [32.5, 40], [35, 38]] as const) {
    s.push(rect(x, top, 2, G - top, { fill: CITY }));
    s.push(poly([[x - 0.2, top], [x + 2.2, top], [x + 1, top - 2.6]], { fill: CITY }));
  }
  // Pennzoil Place: two towers, roofs sloping toward the slot between them.
  s.push(poly([[39, G], [39, 45.5], [43, 43.5], [43, G]], { fill: CITY }));
  s.push(poly([[44, G], [44, 43.5], [48, 45.5], [48, G]], { fill: CITY }));
  // CenterPoint Energy Plaza: pointed crown and a mast.
  s.push(rect(50, 41, 5, G - 41, { fill: CITY }));
  s.push(poly([[50, 41], [55, 41], [52.5, 37.5]], { fill: CITY }));
  s.push(rect(52.2, 35, 0.6, 2.6, { fill: CITY }));
  // East end: lower buildings.
  s.push(rect(57, 48, 4, G - 48, { fill: CITY }));
  s.push(rect(61, 51, 3, G - 51, { fill: CITY }));
  // A few lit windows on the big towers.
  for (const [x, y] of [[22.5, 40], [25, 46], [23.5, 53], [15, 42], [16.5, 50], [6, 50], [8.5, 55], [52, 47], [51, 53], [42, 50], [46, 54]] as const) {
    s.push(rect(x, y, 1, 1.5, { fill: WINDOW, opacity: 0.85 }));
  }
  // The ground runs past the box so a scaled-down foreground still meets the edges.
  s.push(rect(-64, G, 192, 128, { fill: GROUND }));
  return s;
}

function attrString(attrs: Record<string, string | number>): string {
  return Object.entries(attrs)
    .map(([k, v]) => `${k}="${String(v)}"`)
    .join(" ");
}

/** The icon as a standalone SVG document (app/icon.svg). */
export function iconSvg(): string {
  const body = iconShapes()
    .map((sh) => `<${sh.tag} ${attrString(sh.attrs)}/>`)
    .join("");
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64"><defs>${ICON_DEFS}<clipPath id="hv-corner"><rect width="64" height="64" rx="15"/></clipPath></defs><g clip-path="url(#hv-corner)">${body}</g></svg>`;
}
