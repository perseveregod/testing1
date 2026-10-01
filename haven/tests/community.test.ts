import { beforeEach, describe, expect, it } from "vitest";
import { LocalStore } from "@/server/store/local";
import { setStoreForTests } from "@/server/store";
import {
  addCommunityComment,
  COMMUNITY_SEEDS,
  createCommunityEvent,
  flagCommunityItem,
  getCommunityEvent,
  listCommunityEvents,
  nextOccurrence,
  resetCommunitySeedForTests,
  setCommunityGoing,
} from "@/server/services/community";
import { COMMUNITY_LIMITS, eventEndsAt, neighborName } from "@/lib/community";
import { createEventSchema } from "@/lib/validation";

let store: LocalStore;
let ipN = 0;
const ip = () => `10.0.0.${++ipN}`;
const HOUSTON = { lat: 29.76, lng: -95.37 };
const member = (n: number) => store.createUser({ email: `n${n}@example.com`, displayName: `n${n}` });
const inHours = (h: number) => new Date(Date.now() + h * 3_600_000).toISOString();

const draft = (over: Partial<Parameters<typeof createCommunityEvent>[0]> = {}) => ({
  kind: "cleanup" as const,
  title: "Bayou cleanup",
  description: "Gloves provided.",
  startsAt: inHours(26),
  endsAt: inHours(28),
  placeName: "White Oak Bayou Trail",
  latitude: 29.7752,
  longitude: -95.3964,
  ...over,
});

beforeEach(() => {
  store = new LocalStore(null);
  setStoreForTests(store);
  resetCommunitySeedForTests();
});

describe("community board", () => {
  it("seeds a week of labeled demo events around Houston", async () => {
    const events = await listCommunityEvents({ ...HOUSTON, radiusMi: 25, days: 8 }, null);
    expect(events.length).toBe(COMMUNITY_SEEDS.length);
    expect(events.every((e) => e.isDemo)).toBe(true);
    expect(events.every((e) => eventEndsAt(e) > Date.now())).toBe(true);
    const withThread = events.find((e) => e.commentCount > 0)!;
    const detail = await getCommunityEvent(withThread.id, null);
    expect(detail.comments.length).toBe(withThread.commentCount);
    expect(detail.comments[0]!.author).toMatch(/^Neighbor [0-9A-F]{4}$/);
    // Sorted soonest first.
    const starts = events.map((e) => e.startsAt);
    expect(starts).toEqual([...starts].sort());
  });

  it("finds the next weekly occurrence in Houston time, keeping one that's running", () => {
    const seed = { weekday: 6, start: [11, 0] as [number, number], hours: 4 };
    const now = Date.UTC(2026, 9, 1, 15, 0); // Thu Oct 1 2026, 10:00 CDT
    const next = nextOccurrence(seed, now);
    expect(next.toISOString()).toBe("2026-10-03T16:00:00.000Z"); // Sat 11:00 CDT
    const during = Date.UTC(2026, 9, 3, 18, 0); // Sat 13:00 CDT, mid-event
    expect(nextOccurrence(seed, during).toISOString()).toBe("2026-10-03T16:00:00.000Z");
    const after = Date.UTC(2026, 9, 3, 21, 0); // Sat 16:00 CDT, just ended
    expect(nextOccurrence(seed, after).toISOString()).toBe("2026-10-10T16:00:00.000Z");
  });

  it("posts an event with a snapped location and the poster going", async () => {
    const u = await member(1);
    const e = await createCommunityEvent(draft(), u, ip());
    expect(e.mine).toBe(true);
    expect(e.viewerGoing).toBe(true);
    expect(e.goingCount).toBe(1);
    expect(e.latitude).toBe(29.775);
    expect(e.longitude).toBe(-95.396);
    const listed = await listCommunityEvents({ ...HOUSTON, radiusMi: 25, days: 30 }, u);
    expect(listed.find((x) => x.id === e.id)?.viewerGoing).toBe(true);
    // Posting again with the same request id is idempotent.
    const again = await createCommunityEvent(draft({ clientRequestId: "11111111-1111-4111-8111-111111111111" }), u, ip());
    const twice = await createCommunityEvent(draft({ clientRequestId: "11111111-1111-4111-8111-111111111111" }), u, ip());
    expect(twice.id).toBe(again.id);
  });

  it("requires an email, rejects past or far-off dates, and limits posts per day", async () => {
    const guest = await store.createUser({ email: null, displayName: "g" });
    await expect(createCommunityEvent(draft(), guest, ip())).rejects.toMatchObject({ status: 403 });
    const u = await member(2);
    await expect(createCommunityEvent(draft({ startsAt: inHours(-3), endsAt: null }), u, ip())).rejects.toMatchObject({ status: 422 });
    await expect(createCommunityEvent(draft({ startsAt: inHours(24 * 90), endsAt: null }), u, ip())).rejects.toMatchObject({ status: 422 });
    await expect(createCommunityEvent(draft({ endsAt: inHours(25) }), u, ip())).rejects.toMatchObject({ status: 422 });
    for (let i = 0; i < COMMUNITY_LIMITS.eventsPerDay; i++) await createCommunityEvent(draft({ title: `Event ${i}` }), u, ip());
    await expect(createCommunityEvent(draft({ title: "One more" }), u, ip())).rejects.toMatchObject({ status: 429 });
  });

  it("moderates text like reports do", async () => {
    const u = await member(3);
    await expect(createCommunityEvent(draft({ description: "call me at 713 555 0100" }), u, ip())).resolves.toMatchObject({
      description: "call me at [removed]",
    });
    await expect(createCommunityEvent(draft({ title: "I will hurt him" }), u, ip())).rejects.toMatchObject({ status: 422 });
    expect(createEventSchema.safeParse({ ...draft(), kind: "rave" }).success).toBe(false);
  });

  it("counts Going once per person and lets people change their mind", async () => {
    const host = await member(4);
    const e = await createCommunityEvent(draft(), host, ip());
    const a = await member(5);
    expect((await setCommunityGoing(e.id, true, a)).goingCount).toBe(2);
    expect((await setCommunityGoing(e.id, true, a)).goingCount).toBe(2);
    expect((await setCommunityGoing(e.id, false, a)).goingCount).toBe(1);
  });

  it("threads comments under an event with pseudonymous authors", async () => {
    const host = await member(6);
    const e = await createCommunityEvent(draft(), host, ip());
    const a = await member(7);
    const c = await addCommunityComment(e.id, { body: "Is parking free? my number is 713-555-0199" }, a, ip());
    expect(c.author).toBe(neighborName(a.id));
    expect(c.author).not.toContain("@");
    expect(c.body).toBe("Is parking free? my number is [removed]");
    const detail = await getCommunityEvent(e.id, host);
    expect(detail.commentCount).toBe(1);
    expect(detail.comments[0]!.mine).toBe(false);
    for (let i = 1; i < COMMUNITY_LIMITS.commentsPerHour; i++) await addCommunityComment(e.id, { body: `c${i}` }, a, ip());
    await expect(addCommunityComment(e.id, { body: "too many" }, a, ip())).rejects.toMatchObject({ status: 429 });
  });

  it("hides after three different neighbors flag it, and lets authors remove their own", async () => {
    const host = await member(8);
    const e = await createCommunityEvent(draft(), host, ip());
    const c = await addCommunityComment(e.id, { body: "spam spam" }, await member(9), ip());
    const flaggers = await Promise.all([member(10), member(11), member(12)]);
    expect(await flagCommunityItem("comment", c.id, flaggers[0]!)).toEqual({ hidden: false, removed: false });
    expect(await flagCommunityItem("comment", c.id, flaggers[0]!)).toEqual({ hidden: false, removed: false }); // same person twice
    expect(await flagCommunityItem("comment", c.id, flaggers[1]!)).toEqual({ hidden: false, removed: false });
    expect(await flagCommunityItem("comment", c.id, flaggers[2]!)).toEqual({ hidden: true, removed: false });
    expect((await getCommunityEvent(e.id, null)).comments).toHaveLength(0);
    expect((await getCommunityEvent(e.id, null)).commentCount).toBe(0);

    expect(await flagCommunityItem("event", e.id, host)).toEqual({ hidden: true, removed: true });
    await expect(getCommunityEvent(e.id, null)).rejects.toMatchObject({ status: 404 });
    const listed = await listCommunityEvents({ ...HOUSTON, radiusMi: 25, days: 30 }, null);
    expect(listed.some((x) => x.id === e.id)).toBe(false);
  });

  it("only lists events within the radius and window", async () => {
    const u = await member(13);
    await createCommunityEvent(draft({ title: "Dallas thing", latitude: 32.78, longitude: -96.8 }), u, ip());
    await createCommunityEvent(draft({ title: "Next month", startsAt: inHours(24 * 45), endsAt: null }), u, ip());
    const soon = await listCommunityEvents({ ...HOUSTON, radiusMi: 25, days: 30 }, u);
    expect(soon.some((e) => e.title === "Dallas thing")).toBe(false);
    expect(soon.some((e) => e.title === "Next month")).toBe(false);
    const later = await listCommunityEvents({ ...HOUSTON, radiusMi: 25, days: 60 }, u);
    expect(later.some((e) => e.title === "Next month")).toBe(true);
  });
});
