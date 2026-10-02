import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/brand/AppIcon";

// iOS uses this PNG for "Add to Home Screen" (it ignores SVG icons).
export const size = { width: 180, height: 180 };
export const contentType = "image/png";

export default function AppleIcon() {
  return new ImageResponse(<AppIcon size={180} />, size);
}
