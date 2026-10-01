import { createHash } from "node:crypto";
import { NextResponse } from "next/server";
import type { z } from "zod";
import { firstIssue } from "@/lib/validation";

export class ApiError extends Error {
  constructor(
    public status: number,
    message: string,
    public code = "error",
  ) {
    super(message);
  }
}

export function json<T>(body: T, init?: number | ResponseInit) {
  const opts = typeof init === "number" ? { status: init } : (init ?? {});
  return NextResponse.json(body, {
    ...opts,
    headers: { "Cache-Control": "no-store", ...(opts.headers ?? {}) },
  });
}

/**
 * JSON with a content ETag: a poll whose answer hasn't changed gets a 304
 * and no body, so clients can refresh often without paying for it. Responses
 * are still private (`no-store`); only our own fetcher does the matching.
 */
export function jsonConditional<T>(req: Request, body: T, init?: number | ResponseInit) {
  const text = JSON.stringify(body);
  const etag = `W/"${createHash("sha1").update(text).digest("base64url").slice(0, 16)}"`;
  const opts = typeof init === "number" ? { status: init } : (init ?? {});
  const headers = { "Cache-Control": "no-store", ETag: etag, ...(opts.headers ?? {}) };
  if (req.headers.get("if-none-match") === etag) return new NextResponse(null, { status: 304, headers });
  return new NextResponse(text, { ...opts, headers: { ...headers, "Content-Type": "application/json" } });
}

/** Wraps a route handler so thrown ApiErrors become JSON and others become 500s. */
export function route<A extends unknown[]>(fn: (...args: A) => Promise<Response>) {
  return async (...args: A): Promise<Response> => {
    try {
      return await fn(...args);
    } catch (err) {
      if (err instanceof ApiError) {
        return json({ error: err.message, code: err.code }, err.status);
      }
      console.error("[haven] unhandled API error", err);
      return json({ error: "Something went wrong. Please try again.", code: "internal" }, 500);
    }
  };
}

export async function parseBody<S extends z.ZodType>(req: Request, schema: S): Promise<z.infer<S>> {
  const len = Number(req.headers.get("content-length") ?? 0);
  if (len > 16_384) throw new ApiError(413, "Request too large");
  let raw: unknown;
  try {
    raw = await req.json();
  } catch {
    throw new ApiError(400, "Invalid JSON body", "bad_request");
  }
  const parsed = schema.safeParse(raw);
  if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error), "validation");
  return parsed.data;
}

export function parseQuery<S extends z.ZodType>(req: Request, schema: S): z.infer<S> {
  const params = Object.fromEntries(new URL(req.url).searchParams.entries());
  const parsed = schema.safeParse(params);
  if (!parsed.success) throw new ApiError(400, firstIssue(parsed.error), "validation");
  return parsed.data;
}

export function clientIp(req: Request): string {
  // Vercel and most proxies set x-forwarded-for; the first entry is the client.
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0]!.trim();
  return req.headers.get("x-real-ip") ?? "local";
}

// In-memory sliding-window limiter. Per instance only: it blunts bursts and
// scripted abuse cheaply. Durable per-account limits are enforced from the
// database in the report service.
const buckets = new Map<string, number[]>();

export function rateLimit(key: string, max: number, windowMs: number) {
  const now = Date.now();
  const hits = (buckets.get(key) ?? []).filter((t) => now - t < windowMs);
  if (hits.length >= max) {
    const retry = Math.ceil((windowMs - (now - hits[0]!)) / 1000);
    throw new ApiError(429, `Too many requests. Try again in ${retry}s.`, "rate_limited");
  }
  hits.push(now);
  buckets.set(key, hits);
  if (buckets.size > 50_000) buckets.clear();
}
