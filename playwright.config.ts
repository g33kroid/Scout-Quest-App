import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  reporter: process.env.CI ? [["html", { open: "never" }]] : "list",
  use: {
    baseURL: `http://localhost:${PORT}`,
    trace: "on-first-retry",
  },
  webServer: {
    command: "npm run build && npm run start",
    url: `http://localhost:${PORT}`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
  },
  // Breakpoint matrix from docs/tasks/00b-cross-cutting-ui.md — do not add more.
  //
  // Auth specs (*-login.spec.ts) are excluded from every project but
  // 360-baseline: they mutate shared, IP-keyed rate-limit state
  // (scout_credentials/ip_rate_limits), so running the same login 4x in
  // parallel across breakpoint projects causes real collisions, not
  // flakiness in the tests themselves — confirmed while building Task 03's
  // app layer. docs/tasks/03-auth.md only asks for mobile viewport anyway.
  projects: [
    { name: "360-baseline", use: { viewport: { width: 360, height: 640 } } },
    {
      name: "414-large-phone",
      use: { viewport: { width: 414, height: 896 } },
      testIgnore: ["**/*-login.spec.ts"],
    },
    {
      name: "768-tablet",
      use: { viewport: { width: 768, height: 1024 } },
      testIgnore: ["**/*-login.spec.ts"],
    },
    {
      name: "1024-leader-laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 800 } },
      testIgnore: ["**/*-login.spec.ts"],
    },
  ],
});
