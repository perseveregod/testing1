import { json, route } from "@/server/http";
import { getPricing } from "@/server/billing";
import { currentUser } from "@/server/auth/session";

// Per-person: a verified .edu email sees the student price.
export const GET = route(async () => json({ pricing: await getPricing(await currentUser()) }));
