import { ImageResponse } from "next/og";
import { AppIcon } from "@/components/brand/AppIcon";

// PNG app icons for the web manifest (Android home screen, install prompts).
const SIZES = new Set([192, 512]);

export async function GET(_req: Request, ctx: RouteContext<"/icons/[size]">) {
  const { size } = await ctx.params;
  // "/icons/512" or "/icons/maskable-512" (Android pads the latter with its own shape).
  const maskable = size.startsWith("maskable-");
  const n = Number(size.replace(/^maskable-/, "").replace(/\.png$/, ""));
  if (!SIZES.has(n)) return new Response("Not found", { status: 404 });
  return new ImageResponse(<AppIcon size={n} maskable={maskable} />, {
    width: n,
    height: n,
    headers: { "Cache-Control": "public, max-age=31536000, immutable" },
  });
}
