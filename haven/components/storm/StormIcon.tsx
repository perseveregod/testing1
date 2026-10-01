/**
 * Haven's storm mark: a cumulus cloud with a lightning bolt. `active` makes the
 * bolt flash (two quick flickers every few seconds), like a real storm.
 */
export function StormIcon({
  className = "",
  active = false,
  bolt = "#FFC233",
  cloud = "currentColor",
  style,
}: {
  className?: string;
  active?: boolean;
  bolt?: string;
  cloud?: string;
  style?: React.CSSProperties;
}) {
  return (
    <svg viewBox="0 0 32 32" fill="none" className={className} style={style} aria-hidden>
      <defs>
        <linearGradient id="hv-cloud" x1="6" y1="6" x2="26" y2="22" gradientUnits="userSpaceOnUse">
          <stop stopColor={cloud} stopOpacity="1" />
          <stop offset="1" stopColor={cloud} stopOpacity="0.72" />
        </linearGradient>
      </defs>
      {/* Cloud: three lobes over a flat base. */}
      <path
        d="M9.5 21.5a4.5 4.5 0 0 1-.6-8.96A6.5 6.5 0 0 1 21.3 10a5 5 0 0 1 3.2 9.6"
        stroke="url(#hv-cloud)"
        strokeWidth="2.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      <path
        d="M9.5 21.5h2.2M23.5 21.5h.4"
        stroke="url(#hv-cloud)"
        strokeWidth="2.4"
        strokeLinecap="round"
      />
      {/* Bolt */}
      <path
        d="M17.6 15.5 13.4 22h3.3l-1.3 6.5 5.4-8h-3.4l1.2-5Z"
        fill={bolt}
        stroke={bolt}
        strokeWidth="0.8"
        strokeLinejoin="round"
        className={active ? "haven-bolt" : undefined}
        style={active ? { filter: `drop-shadow(0 0 4px ${bolt})` } : undefined}
      />
    </svg>
  );
}
