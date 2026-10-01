import { randomUUID } from "node:crypto";
import { placeSchema } from "@/lib/validation";
import { ApiError, clientIp, json, parseBody, route } from "@/server/http";
import { currentUser, requireUser, toViewer } from "@/server/auth/session";
import { PLAN_LIMITS } from "@/lib/plans";
import { getStore } from "@/server/store";

export const GET = route(async () => {
  const user = await currentUser();
  if (!user) return json({ places: [], max: PLAN_LIMITS.free.maxSavedPlaces });
  const [places, viewer] = await Promise.all([getStore().listPlaces(user.id), toViewer(user)]);
  return json({ places, max: viewer.limits.maxSavedPlaces });
});

export const POST = route(async (req: Request) => {
  const user = await requireUser(clientIp(req));
  const viewer = await toViewer(user);
  const input = await parseBody(req, placeSchema);
  const existing = await getStore().listPlaces(user.id);
  if (existing.length >= viewer.limits.maxSavedPlaces) {
    throw new ApiError(
      403,
      viewer.plan === "free"
        ? "Free accounts can save one place. Haven Lifetime saves up to 10."
        : `You can save up to ${viewer.limits.maxSavedPlaces} places.`,
      "premium_required",
    );
  }
  if (!viewer.limits.placeRules) {
    input.radiusMi = null;
    input.categories = null;
  }
  const place = { id: randomUUID(), createdAt: new Date().toISOString(), ...input };
  await getStore().insertPlace(user.id, place);
  return json({ place }, 201);
});
