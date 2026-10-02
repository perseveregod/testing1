import { approximate } from "@/lib/geo";
import { placePatchSchema } from "@/lib/validation";
import { ApiError, clientIp, json, parseBody, route } from "@/server/http";
import { requireUser, toViewer } from "@/server/auth/session";
import { getStore } from "@/server/store";

export const PATCH = route(async (req: Request, ctx: RouteContext<"/api/places/[id]">) => {
  const { id } = await ctx.params;
  const user = await requireUser(clientIp(req));
  const patch = await parseBody(req, placePatchSchema);
  if ((patch.radiusMi !== undefined || patch.categories !== undefined) && !(await toViewer(user)).limits.placeRules) {
    throw new ApiError(403, "Per-place alert rules are part of Haven Lifetime.", "premium_required");
  }
  if (patch.latitude !== undefined) patch.latitude = approximate({ lat: patch.latitude, lng: 0 }, 3).lat;
  if (patch.longitude !== undefined) patch.longitude = approximate({ lat: 0, lng: patch.longitude }, 3).lng;
  const ok = await getStore().updatePlace(user.id, id, patch);
  if (!ok) throw new ApiError(404, "Place not found", "not_found");
  return json({ ok: true });
});

export const DELETE = route(async (req: Request, ctx: RouteContext<"/api/places/[id]">) => {
  const { id } = await ctx.params;
  const user = await requireUser(clientIp(req));
  const ok = await getStore().deletePlace(user.id, id);
  if (!ok) throw new ApiError(404, "Place not found", "not_found");
  return json({ ok: true });
});
