// Thin fetch wrapper used by every client component. Errors carry the API's
// message and code so screens can show something useful.

export class ApiClientError extends Error {
  constructor(
    message: string,
    public status: number,
    public code: string,
  ) {
    super(message);
  }
}

async function handle<T>(res: Response): Promise<T> {
  let body: unknown = null;
  try {
    body = await res.json();
  } catch {
    // Non-JSON error page (e.g. a proxy). Fall through to a generic message.
  }
  if (!res.ok) {
    const b = (body ?? {}) as { error?: unknown; code?: unknown };
    // Only a plain message is ever shown; anything else (a proxy's error
    // object, an HTML page) gets a generic line instead of "[object Object]".
    const message = typeof b.error === "string" && b.error ? b.error : `Something went wrong (${res.status}). Please try again.`;
    throw new ApiClientError(message, res.status, typeof b.code === "string" ? b.code : "error");
  }
  return body as T;
}

// Polled endpoints answer 304 when nothing changed. Remembering the last
// body per URL lets a poll cost a few hundred bytes instead of the whole
// list, and hands SWR the same object so nothing re-renders.
const etags = new Map<string, { etag: string; body: unknown }>();
const ETAG_LIMIT = 40;

export async function apiGet<T>(url: string): Promise<T> {
  const known = etags.get(url);
  let res: Response;
  try {
    res = await fetch(url, {
      credentials: "same-origin",
      headers: known ? { "If-None-Match": known.etag } : undefined,
    });
  } catch {
    throw new ApiClientError("You're offline or the server can't be reached.", 0, "network");
  }
  if (res.status === 304 && known) return known.body as T;
  const body = await handle<T>(res);
  const etag = res.headers.get("etag");
  if (etag) {
    if (etags.size >= ETAG_LIMIT) etags.delete(etags.keys().next().value!);
    etags.set(url, { etag, body });
  }
  return body;
}

export async function apiSend<T>(url: string, method: "POST" | "PUT" | "PATCH" | "DELETE", body?: unknown): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, {
      method,
      credentials: "same-origin",
      headers: body === undefined ? undefined : { "Content-Type": "application/json" },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiClientError("You're offline or the server can't be reached.", 0, "network");
  }
  return handle<T>(res);
}

export const fetcher = <T,>(url: string) => apiGet<T>(url);

export function errorMessage(err: unknown): string {
  if (err instanceof ApiClientError) return err.message;
  if (err instanceof Error) return err.message;
  return "Something went wrong.";
}
