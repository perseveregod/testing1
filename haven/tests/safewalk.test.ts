import { describe, expect, it } from "vitest";
import { cleanPhone, formatRemaining, mapsLink, missedMessage, smsHref, startMessage } from "@/lib/client/safewalk";
import { getCategory, isCategoryId } from "@/lib/categories";

describe("safe walk helpers", () => {
  it("cleans phone numbers and rejects junk", () => {
    expect(cleanPhone("(713) 555-0142")).toBe("7135550142");
    expect(cleanPhone(" +1 713 555 0142 ")).toBe("+17135550142");
    expect(cleanPhone("12345")).toBeNull();
    expect(cleanPhone("call me")).toBeNull();
  });

  it("formats the countdown", () => {
    expect(formatRemaining(15 * 60_000)).toBe("15:00");
    expect(formatRemaining(61_500)).toBe("1:02");
    expect(formatRemaining(-5000)).toBe("0:00");
  });

  it("builds texts with location and an sms link", () => {
    const walk = { startedAt: 0, endsAt: 15 * 60_000, destination: "home" };
    const here = { lat: 29.76043, lng: -95.36981 };
    expect(mapsLink(here)).toBe("https://maps.google.com/?q=29.76043,-95.36981");
    expect(startMessage(walk, here)).toContain("walking to home");
    expect(missedMessage(walk, null)).toContain("missed my Safe Walk check-in");
    expect(missedMessage(walk, here)).toContain("maps.google.com");
    const href = smsHref("+17135550142", "a & b");
    expect(href).toBe("sms:+17135550142?&body=a%20%26%20b");
  });
});

describe("missing pet category", () => {
  it("is a real category that stays posted for days", () => {
    expect(isCategoryId("missing_pet")).toBe(true);
    expect(getCategory("missing_pet").staleAfterHours).toBeGreaterThanOrEqual(24);
  });
});
