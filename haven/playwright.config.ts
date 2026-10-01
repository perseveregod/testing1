import { defineConfig, devices } from "@playwright/test";

// Three smoke tests against a production build, at phone width. They run in
// CI after the unit tests; locally: `npm run build && npm run e2e`.
const port = Number(process.env.E2E_PORT ?? 3300);

export default defineConfig({
  testDir: "./e2e",
  timeout: 60_000,
  retries: process.env.CI ? 1 : 0,
  reporter: process.env.CI ? "github" : "list",
  // Chromium at phone size (the iPhone preset would ask for WebKit).
  use: {
    baseURL: `http://localhost:${port}`,
    ...devices["Pixel 7"],
    // A preinstalled Chromium (CI installs one; locally PLAYWRIGHT_CHROMIUM points at it).
    launchOptions: process.env.PLAYWRIGHT_CHROMIUM ? { executablePath: process.env.PLAYWRIGHT_CHROMIUM } : undefined,
    locale: "en-US",
    colorScheme: "dark",
    geolocation: { latitude: 29.7604, longitude: -95.3698 },
    permissions: ["geolocation"],
    trace: "retain-on-failure",
  },
  webServer: {
    // A standalone build needs its static assets next to the server.
    command: `cp -r .next/static .next/standalone/.next/ && cp -r public .next/standalone/ && PORT=${port} HOSTNAME=127.0.0.1 node .next/standalone/server.js`,
    url: `http://localhost:${port}/api/health`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    env: {
      INCIDENT_SOURCES: "demo",
      GEOCODER_DISABLED: "1",
      SESSION_SECRET: "e2e-secret-e2e-secret-e2e-secret-1234",
      NEXT_PUBLIC_SITE_URL: `http://localhost:${port}`,
    },
  },
});
