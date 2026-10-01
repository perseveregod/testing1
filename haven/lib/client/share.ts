import { getCategory } from "@/lib/categories";
import type { PublicIncident } from "@/lib/types";

export type ShareResult = "shared" | "copied" | "cancelled" | "failed";

export async function shareIncident(i: PublicIncident): Promise<ShareResult> {
  const url = `${window.location.origin}/incidents/${i.id}`;
  const title = `${getCategory(i.category).label}${i.approximateAddress ? ` near ${i.approximateAddress}` : ""}`;
  const text = `${i.isDemo ? "[Demo] " : ""}${title} on Haven`;
  if (navigator.share) {
    try {
      await navigator.share({ title, text, url });
      return "shared";
    } catch (err) {
      if ((err as DOMException)?.name === "AbortError") return "cancelled";
    }
  }
  try {
    await navigator.clipboard.writeText(`${text}: ${url}`);
    return "copied";
  } catch {
    return "failed";
  }
}
