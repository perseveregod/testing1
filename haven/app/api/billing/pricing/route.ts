import { json, route } from "@/server/http";
import { getPricing } from "@/server/billing";

export const GET = route(async () => json({ pricing: await getPricing() }));
