import { ImageResponse } from "next/og";

export const alt = "Haven: live safety map for Houston";
export const size = { width: 1200, height: 630 };
export const contentType = "image/png";

// A stylized night map (street grid, highways, glowing incident pins) drawn
// with plain boxes so it needs no fonts or network at build time.
export default function OpenGraphImage() {
  const streets = Array.from({ length: 14 }, (_, i) => i);
  const pins = [
    { x: 300, y: 250, c: "#FF7A45" },
    { x: 540, y: 330, c: "#6E8BFF" },
    { x: 760, y: 220, c: "#FF5C8A" },
    { x: 900, y: 420, c: "#F5B84B" },
    { x: 430, y: 470, c: "#3DDC97" },
  ];
  return new ImageResponse(
    (
      <div
        style={{
          width: "100%",
          height: "100%",
          display: "flex",
          position: "relative",
          background: "radial-gradient(90% 60% at 20% 0%, #14213f 0%, #07080a 60%)",
          overflow: "hidden",
          fontFamily: "sans-serif",
        }}
      >
        {streets.map((i) => (
          <div key={`h${i}`} style={{ position: "absolute", left: 0, right: 0, top: i * 48 + 20, height: 2, background: "rgba(255,255,255,0.07)" }} />
        ))}
        {streets.map((i) => (
          <div key={`v${i}`} style={{ position: "absolute", top: 0, bottom: 0, left: i * 92 + 30, width: 2, background: "rgba(255,255,255,0.07)" }} />
        ))}
        <div style={{ position: "absolute", left: -100, top: 300, width: 1500, height: 10, background: "#3a4252", transform: "rotate(-12deg)" }} />
        <div style={{ position: "absolute", left: 620, top: -100, width: 10, height: 900, background: "#3a4252", transform: "rotate(18deg)" }} />
        {pins.map((p, i) => (
          <div key={i} style={{ position: "absolute", left: p.x - 60, top: p.y - 60, width: 120, height: 120, borderRadius: 999, background: p.c, opacity: 0.25, filter: "blur(24px)" }} />
        ))}
        {pins.map((p, i) => (
          <div key={`p${i}`} style={{ position: "absolute", left: p.x - 22, top: p.y - 22, width: 44, height: 44, borderRadius: 999, background: p.c, border: "4px solid white", boxShadow: "0 8px 24px rgba(0,0,0,0.5)" }} />
        ))}
        <div style={{ position: "absolute", left: 0, right: 0, bottom: 0, height: 300, background: "linear-gradient(180deg, rgba(7,8,10,0) 0%, rgba(7,8,10,0.95) 70%)" }} />
        <div style={{ position: "absolute", left: 72, bottom: 64, display: "flex", flexDirection: "column", gap: 14 }}>
          <div style={{ display: "flex", alignItems: "center", gap: 14 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, background: "#ff2d55", color: "white", fontSize: 22, fontWeight: 800, letterSpacing: 2, padding: "6px 14px", borderRadius: 8 }}>
              <div style={{ width: 10, height: 10, borderRadius: 999, background: "white" }} /> LIVE
            </div>
            <div style={{ color: "#c3c9d4", fontSize: 26 }}>Houston · last 24h</div>
          </div>
          <div style={{ color: "white", fontSize: 84, fontWeight: 800, letterSpacing: -3, lineHeight: 1 }}>Haven</div>
          <div style={{ color: "#c3c9d4", fontSize: 34, maxWidth: 900 }}>See what&apos;s happening near you. Report what you see. Walk home safer.</div>
        </div>
      </div>
    ),
    size,
  );
}
