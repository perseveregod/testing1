import { iconDefs, iconElements } from "./AppIcon";

/** The Haven mark for use inside the app (same design as the home-screen icon). */
export function AppIconMark({ className = "size-9" }: { className?: string }) {
  return (
    <svg className={className} viewBox="0 0 64 64" role="img" aria-label="Haven">
      <defs>
        {iconDefs()}
        <clipPath id="hv-mark-corner">
          <rect width="64" height="64" rx="15" />
        </clipPath>
      </defs>
      <g clipPath="url(#hv-mark-corner)">{iconElements()}</g>
    </svg>
  );
}
