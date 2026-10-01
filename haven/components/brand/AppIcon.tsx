/**
 * The Haven app icon drawn with plain boxes so it renders in ImageResponse
 * (home-screen PNGs, Apple touch icon). Same design as app/icon.svg.
 */
export function AppIcon({ size, rounded = false }: { size: number; rounded?: boolean }) {
  const s = size / 64;
  return (
    <div
      style={{
        width: size,
        height: size,
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        background: "linear-gradient(180deg, #13213f 0%, #07080a 100%)",
        borderRadius: rounded ? 15 * s : 0,
      }}
    >
      <svg width={size} height={size} viewBox="0 0 64 64">
        <defs>
          <linearGradient id="sh" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stopColor="#5aa0ff" />
            <stop offset="1" stopColor="#2f6bff" />
          </linearGradient>
        </defs>
        <path d="M32 11 16 17.5v11.8c0 11.1 6.9 19.1 16 22.2 9.1-3.1 16-11.1 16-22.2V17.5L32 11Z" fill="url(#sh)" />
        <circle cx="32" cy="30" r="9.5" fill="none" stroke="rgba(255,255,255,0.45)" strokeWidth="2.2" />
        <circle cx="32" cy="30" r="4.6" fill="#fff" />
      </svg>
    </div>
  );
}
