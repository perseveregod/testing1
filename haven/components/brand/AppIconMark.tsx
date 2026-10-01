/** The Haven mark for use inside the app (same design as the home-screen icon). */
export function AppIconMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Haven">
      <defs>
        <linearGradient id="hv-bg" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#13213f" />
          <stop offset="1" stopColor="#07080a" />
        </linearGradient>
        <linearGradient id="hv-sh" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor="#5aa0ff" />
          <stop offset="1" stopColor="#2f6bff" />
        </linearGradient>
      </defs>
      <rect width="64" height="64" rx="15" fill="url(#hv-bg)" />
      <path d="M32 11 16 17.5v11.8c0 11.1 6.9 19.1 16 22.2 9.1-3.1 16-11.1 16-22.2V17.5L32 11Z" fill="url(#hv-sh)" />
      <circle cx="32" cy="30" r="9.5" fill="none" stroke="#fff" strokeOpacity=".45" strokeWidth="2.2" />
      <circle cx="32" cy="30" r="4.6" fill="#fff" />
    </svg>
  );
}
