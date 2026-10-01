import fs from "node:fs";
import path from "node:path";
import { randomBytes } from "node:crypto";

// All configuration comes from environment variables (see .env.example).
// Nothing secret is ever hard-coded; dev-only fallbacks are clearly marked.

const env = process.env;
export const isProduction = env.NODE_ENV === "production";

function num(name: string, fallback: number): number {
  const v = Number(env[name]);
  return Number.isFinite(v) && env[name] !== "" && env[name] != null ? v : fallback;
}

const DATA_DIR = env.HAVEN_DATA_DIR || (env.VERCEL ? "/tmp/haven" : path.join(process.cwd(), ".data"));

let devSecret: string | null = null;
function sessionSecret(): string {
  if (env.SESSION_SECRET && env.SESSION_SECRET.length >= 32) return env.SESSION_SECRET;
  if (isProduction && env.HAVEN_ALLOW_INSECURE_SECRET !== "1") {
    throw new Error("SESSION_SECRET must be set (32+ characters) in production.");
  }
  // Development only: a random secret persisted next to the local data file.
  if (!devSecret) {
    const file = path.join(DATA_DIR, "dev-session-secret");
    try {
      devSecret = fs.readFileSync(file, "utf8").trim();
    } catch {
      devSecret = randomBytes(32).toString("hex");
      fs.mkdirSync(DATA_DIR, { recursive: true });
      fs.writeFileSync(file, devSecret, { mode: 0o600 });
    }
  }
  return devSecret;
}

export const config = {
  appName: "Haven",
  get appUrlConfigured() {
    return Boolean(env.NEXT_PUBLIC_APP_URL);
  },
  get appUrl() {
    return (env.NEXT_PUBLIC_APP_URL || "http://localhost:3000").replace(/\/$/, "");
  },
  get sessionSecret() {
    return sessionSecret();
  },
  store: {
    get kind(): "supabase" | "local" {
      return env.SUPABASE_URL && env.SUPABASE_SERVICE_ROLE_KEY ? "supabase" : "local";
    },
    supabaseUrl: env.SUPABASE_URL ?? "",
    supabaseServiceRoleKey: env.SUPABASE_SERVICE_ROLE_KEY ?? "",
    supabaseAnonKey: env.SUPABASE_ANON_KEY ?? "",
    localFile: env.HAVEN_DATA_FILE || path.join(DATA_DIR, "haven.json"),
  },
  billing: {
    get stripeSecretKey() {
      return env.STRIPE_SECRET_KEY ?? "";
    },
    get stripeWebhookSecret() {
      return env.STRIPE_WEBHOOK_SECRET ?? "";
    },
    /** Optional: a Stripe Price id. When unset, price comes from the two values below. */
    stripePriceId: env.STRIPE_LIFETIME_PRICE_ID ?? "",
    lifetimeAmountCents: num("LIFETIME_PRICE_CENTS", 1000),
    /** Lifetime price for verified .edu emails (default: half off). */
    studentAmountCents: num("STUDENT_PRICE_CENTS", 500),
    currency: (env.LIFETIME_PRICE_CURRENCY || "usd").toLowerCase(),
    /** The fake checkout is only ever available outside production unless forced. */
    get testCheckoutEnabled() {
      return !env.STRIPE_SECRET_KEY && (!isProduction || env.HAVEN_ENABLE_TEST_CHECKOUT === "1");
    },
  },
  push: {
    /** Web Push (VAPID). Generate once with `npx web-push generate-vapid-keys`. */
    publicKey: env.NEXT_PUBLIC_VAPID_PUBLIC_KEY ?? "",
    privateKey: env.VAPID_PRIVATE_KEY ?? "",
    subject: env.VAPID_SUBJECT || (env.HAVEN_CONTACT_EMAIL ? `mailto:${env.HAVEN_CONTACT_EMAIL}` : "mailto:hello@haven.app"),
    get enabled(): boolean {
      return Boolean(this.publicKey && this.privateKey);
    },
  },
  sources: {
    /**
     * Comma list of adapters to ingest. "demo" seeds labeled demo incidents;
     * "houston_active" is the City of Houston dispatch page (default area).
     */
    get enabled(): string[] {
      return (env.INCIDENT_SOURCES ?? "demo,houston_active")
        .split(",")
        .map((s) => s.trim())
        .filter(Boolean);
    },
    demoCenter: {
      lat: num("DEMO_CENTER_LAT", num("NEXT_PUBLIC_DEFAULT_LAT", 29.7604)),
      lng: num("DEMO_CENTER_LNG", num("NEXT_PUBLIC_DEFAULT_LNG", -95.3698)),
    },
    /** Minimum minutes between automatic (on-read) ingests. */
    ingestIntervalMin: num("INGEST_INTERVAL_MIN", 5),
    cronSecret: env.CRON_SECRET ?? "",
    contactEmail: env.HAVEN_CONTACT_EMAIL ?? "",
  },
  email: {
    /** Resend (resend.com) API key. When set, Haven emails sign-in codes itself instead of through Supabase Auth. */
    get resendApiKey() {
      return env.RESEND_API_KEY ?? "";
    },
    /** Sender shown on sign-in emails. Resend's shared sender works until a domain is verified. */
    from: env.EMAIL_FROM || "Haven <onboarding@resend.dev>",
  },
  geocoder: {
    /** Nominatim-compatible endpoint. Use your own or a paid provider in production. */
    url: (env.GEOCODER_URL || "https://nominatim.openstreetmap.org").replace(/\/$/, ""),
    get disabled() {
      return env.GEOCODER_DISABLED === "1";
    },
  },
  limits: {
    reportsPerHour: num("REPORTS_PER_HOUR", 5),
    reportsPerDay: num("REPORTS_PER_DAY", 20),
    flagsToHide: num("FLAGS_TO_HIDE", 3),
    endedVotesToResolve: num("ENDED_VOTES_TO_RESOLVE", 3),
  },
};
