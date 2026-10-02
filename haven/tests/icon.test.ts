import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";
import { iconSvg } from "@/lib/brand/icon";

describe("app icon", () => {
  it("app/icon.svg is generated from lib/brand/icon.ts (run `npm run icon` after changing it)", () => {
    expect(readFileSync("app/icon.svg", "utf8").trim()).toBe(iconSvg());
  });
});
