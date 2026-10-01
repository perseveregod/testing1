import { z } from "zod";
import { CATEGORY_IDS } from "./categories";
import { MAX_DESCRIPTION, MAX_UPDATE } from "./moderation";
import type { CategoryId } from "./types";

// Request schemas shared by API routes (and usable by future native clients).

const lat = z.number().finite().min(-90).max(90);
const lng = z.number().finite().min(-180).max(180);
const category = z.enum(CATEGORY_IDS as [CategoryId, ...CategoryId[]]);
const hhmm = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/, "Use HH:MM");

export const createReportSchema = z.object({
  category,
  latitude: lat,
  longitude: lng,
  description: z.string().max(MAX_DESCRIPTION * 2).default(""),
  /** Client-generated id so a retried submit can't create a second report. */
  clientRequestId: z.string().min(8).max(64).optional(),
});

export const incidentUpdateSchema = z.object({
  body: z.string().min(1).max(MAX_UPDATE * 2),
});

export const flagSchema = z.object({
  reason: z.enum(["false", "duplicate", "personal_info", "offensive", "other"]),
});

export const placeSchema = z.object({
  kind: z.enum(["home", "work", "school", "family", "custom"]),
  label: z.string().trim().min(1).max(40),
  latitude: lat,
  longitude: lng,
  address: z.string().trim().max(160).default(""),
  alertsEnabled: z.boolean().default(true),
  radiusMi: z.number().min(0.5).max(100).nullable().default(null),
  categories: z.array(category).max(CATEGORY_IDS.length).nullable().default(null),
});

export const placePatchSchema = placeSchema.partial();

export const alertPrefsSchema = z.object({
  enabled: z.boolean(),
  radiusMi: z.number().min(0.5).max(100),
  categories: z.array(category).max(CATEGORY_IDS.length),
  savedPlaceAlerts: z.boolean(),
  criticalOnly: z.boolean(),
  quietHoursStart: hhmm.nullable(),
  quietHoursEnd: hhmm.nullable(),
  timeZone: z.string().max(64).regex(/^[A-Za-z_+\-/0-9]+$/).nullable().default(null),
  nearMe: z.boolean(),
});

export const locationSchema = z.object({ latitude: lat, longitude: lng });

export const emailStartSchema = z.object({ email: z.string().trim().toLowerCase().email().max(254) });
export const emailVerifySchema = z.object({
  email: z.string().trim().toLowerCase().email().max(254),
  code: z.string().trim().regex(/^\d{6}$/, "Enter the 6-digit code"),
});

export const listQuerySchema = z.object({
  lat: z.coerce.number().pipe(lat).optional(),
  lng: z.coerce.number().pipe(lng).optional(),
  radiusMi: z.coerce.number().min(0.1).max(100).default(10),
  categories: z
    .string()
    .optional()
    .transform((s) => (s ? s.split(",").filter(Boolean) : []))
    .pipe(z.array(category)),
  sinceHours: z.coerce.number().min(1).max(24 * 365).optional(),
  minSeverity: z.enum(["low", "moderate", "high", "critical"]).optional(),
  verifiedOnly: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === "1" || v === "true"),
  includeResolved: z
    .enum(["0", "1", "true", "false"])
    .optional()
    .transform((v) => v === undefined || v === "1" || v === "true"),
  sort: z.enum(["distance", "newest"]).default("newest"),
  limit: z.coerce.number().int().min(1).max(500).default(200),
});

export type ListQuery = z.infer<typeof listQuerySchema>;

export function firstIssue(err: z.ZodError): string {
  const i = err.issues[0];
  if (!i) return "Invalid request";
  const path = i.path.join(".");
  return path ? `${path}: ${i.message}` : i.message;
}
