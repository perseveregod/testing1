import { expect, test } from "@playwright/test";

// Skip the welcome screens and the map intro so each test starts on content.
test.beforeEach(async ({ context }) => {
  await context.addInitScript(() => {
    try {
      localStorage.setItem("haven.welcomed.v1", "1");
      localStorage.setItem("haven.lang.v1", "en");
      localStorage.setItem("haven.tips.v1", JSON.stringify(["pin"]));
    } catch {
      // ignore
    }
  });
});

test("the feed lists incidents near downtown", async ({ page }) => {
  await page.goto("/feed");
  await expect(page.getByRole("heading", { name: "Near you" })).toBeVisible();
  // Demo data seeds on the first request; rows link to incident pages.
  const rows = page.locator("a[href^='/incidents/']");
  await expect(rows.first()).toBeVisible({ timeout: 30_000 });
  expect(await rows.count()).toBeGreaterThan(3);
  await expect(page.getByText(/active · 5 mi/)).toBeVisible();
});

test("the map opens with the nearby sheet and a count", async ({ page }) => {
  await page.goto("/");
  const sheet = page.locator("section[aria-label*='active incident']");
  await expect(sheet).toBeVisible({ timeout: 30_000 });
  await expect(sheet.getByText(/\d+ active incidents?/)).toBeVisible();
  // The tab bar is there and the Report button is the big one.
  await expect(page.getByRole("link", { name: "Report an incident" })).toBeVisible();
});

test("a report goes through all four steps", async ({ page }) => {
  await page.goto("/report");
  await expect(page.getByRole("heading", { name: "What's happening?" })).toBeVisible();
  await page.getByRole("button", { name: /Road Hazard/ }).click();
  await expect(page.getByRole("heading", { name: "Where is it?" })).toBeVisible();
  await page.getByRole("button", { name: "Confirm location" }).click();
  await expect(page.getByRole("heading", { name: "Add details" })).toBeVisible();
  await page.getByLabel("Describe what you see").fill("Smoke test: debris in the right lane, two cones out.");
  await page.getByRole("button", { name: "Continue" }).click();
  await expect(page.getByRole("heading", { name: "Review" })).toBeVisible();
  await page.getByRole("button", { name: "Submit report" }).click();
  await expect(page.getByRole("heading", { name: /Report shared|Added to an existing report/ })).toBeVisible({ timeout: 20_000 });
});
