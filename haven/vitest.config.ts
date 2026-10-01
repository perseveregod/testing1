import path from "node:path";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: { alias: { "@": path.resolve(__dirname) } },
  test: {
    environment: "node",
    include: ["tests/**/*.test.ts"],
    env: { GEOCODER_DISABLED: "1", SESSION_SECRET: "test-secret-test-secret-test-secret-1234", INCIDENT_SOURCES: "demo" },
  },
});
