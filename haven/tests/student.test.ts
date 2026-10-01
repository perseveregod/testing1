import { describe, expect, it } from "vitest";
import { getPricing, isStudentEmail } from "@/server/billing";
import { CAMPUSES, getCampus, telHref } from "@/lib/campuses";

describe("student pricing", () => {
  it("recognises .edu addresses only", () => {
    expect(isStudentEmail("maria@uh.edu")).toBe(true);
    expect(isStudentEmail("j.doe@student.hccs.EDU")).toBe(true);
    expect(isStudentEmail("someone@gmail.com")).toBe(false);
    expect(isStudentEmail("edu@gmail.com")).toBe(false);
    expect(isStudentEmail("x@uh.edu.evil.com")).toBe(false);
    expect(isStudentEmail(null)).toBe(false);
  });

  it("gives a verified .edu account the student price", async () => {
    const full = await getPricing(null);
    expect(full.student).toBeNull();
    expect(full.amountCents).toBe(1000);
    expect(full.studentFormatted).toBe("$5.00");

    const student = await getPricing({ email: "maria@uh.edu" });
    expect(student.amountCents).toBe(500);
    expect(student.formatted).toBe("$5.00");
    expect(student.student).toEqual({ fullFormatted: full.formatted, percentOff: 50 });

    const other = await getPricing({ email: "maria@gmail.com" });
    expect(other.amountCents).toBe(1000);
  });
});

describe("campus hub", () => {
  it("has unique ids, Houston coordinates and dialable numbers", () => {
    expect(new Set(CAMPUSES.map((c) => c.id)).size).toBe(CAMPUSES.length);
    for (const c of CAMPUSES) {
      expect(c.lat).toBeGreaterThan(29.5);
      expect(c.lat).toBeLessThan(30.1);
      expect(c.lng).toBeGreaterThan(-95.8);
      expect(c.lng).toBeLessThan(-95.0);
      expect(telHref(c.police.emergency)).toMatch(/^tel:\d{3,10}$/);
      expect(telHref(c.police.nonEmergency)).toMatch(/^tel:\d{10}$/);
      expect(c.police.url).toMatch(/^https:\/\//);
    }
    expect(getCampus("uh")?.name).toBe("University of Houston");
    expect(getCampus("nope")).toBeNull();
  });
});
