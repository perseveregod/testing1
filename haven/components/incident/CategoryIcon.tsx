import { getCategory } from "@/lib/categories";
import type { CategoryId } from "@/lib/types";
import { CategoryGlyph } from "./AnimatedIcons";

const SIZES = {
  sm: { box: "size-7", icon: "size-[16px]" },
  md: { box: "size-9", icon: "size-[20px]" },
  lg: { box: "size-12", icon: "size-[26px]" },
  xl: { box: "size-16", icon: "size-9" },
};

/**
 * Category glyph in a softly tinted circle. `animated` plays the glyph's
 * motion (flicker, sweep, pulse); leave it off in long lists.
 */
export function CategoryIcon({
  category,
  size = "md",
  muted,
  animated = false,
  glow,
}: {
  category: CategoryId;
  size?: keyof typeof SIZES;
  muted?: boolean;
  animated?: boolean;
  /** Adds a soft outer glow in the category color. */
  glow?: boolean;
}) {
  const def = getCategory(category);
  const s = SIZES[size];
  return (
    <span
      className={`inline-flex shrink-0 items-center justify-center rounded-full ${s.box}`}
      style={{
        backgroundColor: muted ? "rgba(255,255,255,0.05)" : `color-mix(in srgb, ${def.color} 16%, transparent)`,
        color: muted ? "var(--faint)" : def.color,
        boxShadow: glow && !muted ? `0 0 24px color-mix(in srgb, ${def.color} 45%, transparent)` : undefined,
      }}
      aria-hidden
    >
      <CategoryGlyph category={category} animated={animated && !muted} className={s.icon} />
    </span>
  );
}
