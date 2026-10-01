import { describe, expect, it } from "vitest";
import { CATEGORIES } from "@/lib/categories";
import { t, TITLES_ES } from "@/lib/i18n";
import { incidentTitle } from "@/lib/client/lang";
import { timeAgoIn } from "@/lib/time";

describe("Spanish", () => {
  it("fills slots in both languages", () => {
    expect(t("en", "near.withinYou", { n: 5 })).toBe("Within 5 mi of you");
    expect(t("es", "near.withinYou", { n: 5 })).toBe("A menos de 5 mi de usted");
    expect(t("es", "common.showMore", { n: 12 })).toBe("Ver 12 más");
  });

  it("every category has Spanish names", () => {
    for (const c of CATEGORIES) {
      expect(c.labelEs.length, c.id).toBeGreaterThan(0);
      expect(c.shortEs.length, c.id).toBeGreaterThan(0);
      expect(c.hintEs.length, c.id).toBeGreaterThan(0);
    }
  });

  it("translates Haven's own titles and keeps people's words", () => {
    const base = { category: "fire" as const, storm: null };
    expect(incidentTitle({ ...base, title: "Fire" }, "es")).toBe("Incendio");
    expect(incidentTitle({ ...base, title: "Building fire" }, "es")).toBe(TITLES_ES["Building fire"]);
    expect(incidentTitle({ ...base, title: "Smoke near my building on Elgin" }, "es")).toBe("Smoke near my building on Elgin");
    expect(incidentTitle({ ...base, title: "Building fire" }, "en")).toBe("Building fire");
    // Storm reports are composed from their state, in either language.
    expect(incidentTitle({ category: "flooding", title: "x", storm: { state: "flooded", placeType: null } }, "es")).toBe("Inundada, no maneje");
  });

  it("relative times read naturally in Spanish", () => {
    const now = Date.UTC(2026, 9, 1, 12, 0, 0);
    expect(timeAgoIn("es", new Date(now - 20_000).toISOString(), now)).toBe("ahora mismo");
    expect(timeAgoIn("es", new Date(now - 5 * 60_000).toISOString(), now)).toBe("hace 5 min");
    expect(timeAgoIn("es", new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("hace 3 h");
    expect(timeAgoIn("en", new Date(now - 3 * 3_600_000).toISOString(), now)).toBe("3 hr ago");
  });
});

import { updateBody } from "@/lib/i18n";

describe("timeline lines", () => {
  it("translates the server's templates and keeps people's words", () => {
    expect(updateBody("Reported by Houston Fire Department.", "es")).toBe("Reportado por Houston Fire Department.");
    expect(updateBody('First reported: "smoke on Elgin"', "es")).toBe('Primer reporte: "smoke on Elgin"');
    expect(updateBody("Source updated status to contained.", "es")).toBe("La fuente cambió el estado a contenido.");
    expect(updateBody("Two lanes open now", "es")).toBe("Two lanes open now");
    expect(updateBody("Reported by Houston Fire Department.", "en")).toBe("Reported by Houston Fire Department.");
  });
});
