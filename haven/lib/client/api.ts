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
    const b = (body ?? {}) as { error?: string; code?: string };
    throw new ApiClientError(b.error ?? `Request failed (${res.status})`, res.status, b.code ?? "error");
  }
  return body as T;
}

export async function apiGet<T>(url: string): Promise<T> {
  let res: Response;
  try {
    res = await fetch(url, { credentials: "same-origin" });
  } catch {
    throw new ApiClientError("You're offline or the server can't be reached.", 0, "network");
  }
  return handle<T>(res);
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
