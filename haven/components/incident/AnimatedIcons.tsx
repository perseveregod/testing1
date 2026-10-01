"use client";

import { useId } from "react";
import type { CategoryId } from "@/lib/types";

// Layered, animated category glyphs. Each is a 24×24 SVG drawn in
// `currentColor` with a lighter highlight tone, so they inherit whatever
// color the surrounding element sets. Keyframes live in globals.css under
// "animated icons". Pass `animated={false}` for a still version (lists).

export interface IconProps {
  className?: string;
  animated?: boolean;
  style?: React.CSSProperties;
}

const HI = "color-mix(in srgb, currentColor 45%, white)";
const origin = (x: string, y: string): React.CSSProperties => ({
  transformOrigin: `${x} ${y}`,
  transformBox: "fill-box",
});

/** Vertical gradient from the highlight tone (top) into the base color. */
function Grad({
  id,
  from = 0.95,
  to = 0.75,
}: {
  id: string;
  from?: number;
  to?: number;
}) {
  return (
    <linearGradient id={id} x1="0" y1="0" x2="0" y2="1">
      <stop offset="0" stopColor={HI} stopOpacity={from} />
      <stop offset="1" stopColor="currentColor" stopOpacity={to} />
    </linearGradient>
  );
}

function Svg({
  className,
  animated = true,
  style,
  children,
  label,
}: IconProps & { children: React.ReactNode; label: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      className={`aic ${animated ? "aic-live" : "aic-static"} ${className ?? ""}`}
      style={style}
      role="img"
      aria-label={label}
      fill="none"
    >
      {children}
    </svg>
  );
}

export function FireIcon(p: IconProps) {
  const id = useId();
  return (
    <Svg {...p} label="Fire">
      <defs>
        <Grad id={id} from={0.5} to={0.95} />
        <radialGradient id={`${id}-base`}>
          <stop offset="0" stopColor="currentColor" stopOpacity={0.6} />
          <stop offset="1" stopColor="currentColor" stopOpacity={0} />
        </radialGradient>
      </defs>
      <ellipse
        className="aic-beacon"
        style={origin("50%", "50%")}
        cx="12"
        cy="20.5"
        rx="7"
        ry="2.4"
        fill={`url(#${id}-base)`}
      />
      <g transform="translate(-3.6 -5.5) scale(1.3)">
        <path
          className="aic-flame"
          style={origin("50%", "100%")}
          d="M12 2.5c.6 3.2 4.5 5.2 4.5 9.5a4.5 4.5 0 0 1-9 0c0-1.7.6-3 1.5-4.1.3 1.2 1 2 1.9 2.1C10.2 7.3 10.5 5 12 2.5z"
          fill={`url(#${id})`}
          opacity={0.8}
          transform="translate(0 4)"
        />
        <path
          className="aic-flame aic-d2"
          style={origin("50%", "100%")}
          d="M12 9c.4 2 2.6 3 2.6 5.3a2.6 2.6 0 0 1-5.2 0c0-1 .4-1.8 1-2.5.2.7.6 1.2 1.1 1.3C11.3 11.6 11.3 10.3 12 9z"
          fill="currentColor"
          transform="translate(0 3)"
        />
        <path
          className="aic-flame aic-d3"
          style={{ ...origin("50%", "100%"), fill: HI }}
          d="M12 13.2c.2 1 1.3 1.6 1.3 2.8a1.3 1.3 0 0 1-2.6 0c0-.6.3-1.1.6-1.5.1.3.3.6.6.7-.1-.7 0-1.3.1-2z"
          transform="translate(0 2.5)"
        />
        {[
          [9.2, 15, 0],
          [14.6, 14, 0.9],
          [12.2, 16.5, 1.7],
        ].map(([x, y, d]) => (
          <circle
            key={x}
            className="aic-ember"
            style={{ animationDelay: `${d}s`, fill: HI }}
            cx={x}
            cy={y}
            r="0.75"
          />
        ))}
      </g>
    </Svg>
  );
}

export function PoliceIcon(p: IconProps) {
  const id = useId();
  const shield =
    "M12 2.8l7.2 2.6v5.4c0 4.7-3.1 8.6-7.2 9.9-4.1-1.3-7.2-5.2-7.2-9.9V5.4L12 2.8z";
  return (
    <Svg {...p} label="Police activity">
      <clipPath id={id}>
        <path d={shield} />
      </clipPath>
      <path d={shield} fill="currentColor" opacity={0.3} />
      <g clipPath={`url(#${id})`}>
        <path
          className="aic-sweep"
          style={{ ...origin("0%", "100%"), fill: HI }}
          d="M12 11.5V1.5a10 10 0 0 1 7.1 2.9z"
          opacity={0.75}
        />
        <path
          className="aic-sweep"
          style={{ ...origin("100%", "0%"), fill: "currentColor" }}
          d="M12 11.5v10a10 10 0 0 1-7.1-2.9z"
          opacity={0.9}
        />
      </g>
      <path
        d={shield}
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinejoin="round"
      />
      <circle
        className="aic-beacon"
        style={{ ...origin("50%", "50%"), fill: HI }}
        cx="12"
        cy="11.5"
        r="1.6"
      />
    </Svg>
  );
}

export function MedicalIcon(p: IconProps) {
  const id = useId();
  return (
    <Svg {...p} label="Medical emergency">
      <defs>
        <Grad id={id} from={0.55} to={0.95} />
      </defs>
      <path
        className="aic-beat"
        style={origin("50%", "50%")}
        d="M12 20.5l-1.4-1.3C5.4 14.5 2.5 11.8 2.5 8.5 2.5 5.8 4.6 3.8 7.2 3.8c1.5 0 3 .7 3.9 1.8l.9 1 .9-1c.9-1.1 2.4-1.8 3.9-1.8 2.6 0 4.7 2 4.7 4.7 0 3.3-2.9 6-7.8 10.7L12 20.5z"
        fill={`url(#${id})`}
      />
      <path
        className="aic-ecg"
        d="M4 11.5h4.2l1.5-3 2 6.5 2-5.5 1.3 2H20"
        stroke={HI}
        strokeWidth={1.5}
        strokeLinecap="round"
        strokeLinejoin="round"
      />
    </Svg>
  );
}

export function TrafficIcon(p: IconProps) {
  const id = useId();
  return (
    <Svg {...p} label="Traffic accident">
      <defs>
        <Grad id={id} from={0.5} to={0.95} />
      </defs>
      <path
        d="M4.5 12.8l1.7-4.6A2.2 2.2 0 0 1 8.3 6.8h7.4a2.2 2.2 0 0 1 2.1 1.4l1.7 4.6V18a1 1 0 0 1-1 1h-1.4a1 1 0 0 1-1-1v-1.1H7.9V18a1 1 0 0 1-1 1H5.5a1 1 0 0 1-1-1v-5.2z"
        fill={`url(#${id})`}
      />
      <path d="M7.6 8.6h8.8l1 3H6.6l1-3z" fill="#0b0c0f" opacity={0.35} />
      <circle
        className="aic-hazard"
        style={{ fill: HI }}
        cx="7.6"
        cy="14.4"
        r="1.25"
      />
      <circle
        className="aic-hazard"
        style={{ fill: HI }}
        cx="16.4"
        cy="14.4"
        r="1.25"
      />
      <g
        className="aic-spark"
        stroke={HI}
        strokeWidth={1.2}
        strokeLinecap="round"
      >
        <path d="M19.5 5.5l1.5-1.5M20.5 8h2M18 4V2" />
      </g>
    </Svg>
  );
}

export function HazardIcon(p: IconProps) {
  const id = useId();
  return (
    <Svg {...p} label="Road hazard">
      <clipPath id={id}>
        <rect x="3" y="7.5" width="18" height="7" rx="1.5" />
      </clipPath>
      <rect
        x="3"
        y="7.5"
        width="18"
        height="7"
        rx="1.5"
        fill="currentColor"
        opacity={0.28}
      />
      <g clipPath={`url(#${id})`}>
        <g className="aic-stripes" stroke="currentColor" strokeWidth={2.8}>
          {[-4, 3, 10, 17, 24, 31].map((x) => (
            <path key={x} d={`M${x} 16l5-10`} />
          ))}
        </g>
      </g>
      <rect
        x="3"
        y="7.5"
        width="18"
        height="7"
        rx="1.5"
        stroke="currentColor"
        strokeWidth={1.2}
      />
      <path
        d="M6 14.5v4M18 14.5v4M4.5 18.5h3M16.5 18.5h3"
        stroke="currentColor"
        strokeWidth={1.6}
        strokeLinecap="round"
      />
    </Svg>
  );
}

export function SuspiciousIcon(p: IconProps) {
  return (
    <Svg {...p} label="Suspicious activity">
      <g className="aic-blink" style={origin("50%", "50%")}>
        <path
          d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z"
          fill="currentColor"
          opacity={0.22}
        />
        <path
          d="M2.5 12s3.4-6 9.5-6 9.5 6 9.5 6-3.4 6-9.5 6-9.5-6-9.5-6z"
          stroke="currentColor"
          strokeWidth={1.5}
          strokeLinejoin="round"
        />
        <g className="aic-scan">
          <circle cx="12" cy="12" r="3.3" fill="currentColor" />
          <circle cx="12" cy="12" r="1.5" fill="#0b0c0f" opacity={0.8} />
          <circle cx="13.1" cy="10.9" r="0.7" style={{ fill: HI }} />
        </g>
      </g>
    </Svg>
  );
}

export function WeatherIcon(p: IconProps) {
  const id = useId();
  return (
    <Svg {...p} label="Severe weather">
      <defs>
        <Grad id={id} from={0.6} to={0.9} />
      </defs>
      <path
        d="M7 16.5a4 4 0 0 1-.6-7.95A5.5 5.5 0 0 1 17 7h.5a4.75 4.75 0 0 1 0 9.5H7z"
        fill={`url(#${id})`}
      />
      <path
        className="aic-flash"
        d="M13.2 9.5l-2.8 4.6h2.2l-1.2 3.9 3.4-5.4h-2.2l.6-3.1z"
        style={{ fill: HI }}
      />
      {[
        [7.2, 0],
        [10.4, 0.5],
        [15.8, 0.25],
      ].map(([x, d]) => (
        <path
          key={x}
          className="aic-rain"
          style={{ animationDelay: `${d}s` }}
          d={`M${x} 18.2l-.8 2.4`}
          stroke="currentColor"
          strokeWidth={1.4}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

export function SafetyIcon(p: IconProps) {
  return (
    <Svg {...p} label="Public safety">
      <path
        d="M3 9.8v4.4a1 1 0 0 0 1 1h2.2l6.3 4.1V4.7L6.2 8.8H4a1 1 0 0 0-1 1z"
        fill="currentColor"
        opacity={0.9}
      />
      <path
        d="M6.5 15.4l1 4.4a1 1 0 0 0 1 .8h1.2"
        stroke="currentColor"
        strokeWidth={1.5}
        strokeLinecap="round"
      />
      {[
        ["M15.2 9.3a3.9 3.9 0 0 1 0 5.4", 0],
        ["M17.3 7.2a6.8 6.8 0 0 1 0 9.6", 0.35],
        ["M19.4 5.1a9.8 9.8 0 0 1 0 13.8", 0.7],
      ].map(([d, delay]) => (
        <path
          key={d}
          className="aic-wave"
          style={{ ...origin("0%", "50%"), animationDelay: `${delay}s` }}
          d={d as string}
          stroke={HI}
          strokeWidth={1.6}
          strokeLinecap="round"
        />
      ))}
    </Svg>
  );
}

export function OtherIcon(p: IconProps) {
  return (
    <Svg {...p} label="Other">
      {[0, 1].map((i) => (
        <circle
          key={i}
          className="aic-ring"
          style={{ ...origin("50%", "50%"), animationDelay: `${i * 1.1}s` }}
          cx="12"
          cy="12"
          r="3"
          stroke="currentColor"
          strokeWidth={1.2}
        />
      ))}
      <circle cx="12" cy="12" r="2.4" fill="currentColor" />
      <circle cx="12" cy="12" r="1" style={{ fill: HI }} />
    </Svg>
  );
}

export const ANIMATED_ICONS: Record<
  CategoryId,
  (p: IconProps) => React.JSX.Element
> = {
  police: PoliceIcon,
  fire: FireIcon,
  medical: MedicalIcon,
  traffic_accident: TrafficIcon,
  road_hazard: HazardIcon,
  suspicious: SuspiciousIcon,
  severe_weather: WeatherIcon,
  public_safety: SafetyIcon,
  other: OtherIcon,
};

export function CategoryGlyph({
  category,
  ...p
}: IconProps & { category: CategoryId }) {
  const Icon = ANIMATED_ICONS[category];
  return <Icon {...p} />;
}
