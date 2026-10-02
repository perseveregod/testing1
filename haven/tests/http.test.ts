import { describe, expect, it } from "vitest";
import { jsonConditional } from "@/server/http";

const req = (etag?: string) => new Request("http://h/api/x", { headers: etag ? { "if-none-match": etag } : {} });

describe("conditional JSON (polling without paying for unchanged answers)", () => {
  it("tags the body, answers 304 to a matching tag, and 200 to a stale one", async () => {
    const first = jsonConditional(req(), { items: [1, 2] });
    expect(first.status).toBe(200);
    const tag = first.headers.get("etag")!;
    expect(tag).toMatch(/^W\/"/);
    expect(first.headers.get("cache-control")).toBe("no-store");
    expect(await first.json()).toEqual({ items: [1, 2] });

    const same = jsonConditional(req(tag), { items: [1, 2] });
    expect(same.status).toBe(304);
    expect(same.headers.get("etag")).toBe(tag);
    expect(await same.text()).toBe("");

    const changed = jsonConditional(req(tag), { items: [1, 2, 3] });
    expect(changed.status).toBe(200);
    expect(changed.headers.get("etag")).not.toBe(tag);
  });
});
