import { defineConfig, devices } from "@playwright/test";

const PORT = 3000;

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: true,
  // Capped at 1: several specs share the same seeded leader/scout identities
  // (scout-login, leader-login, leader-scoring all touch FIXTURES.leaderId
  // or .scoutId) and mutate shared server state — TOTP enrollment,
  // scout_credentials/ip_rate_limits, ledger rows. Excluding *within* one
  // file (test.describe.configure({mode:"serial"}) in leader-scoring.spec.ts)
  // wasn't enough: different FILES running concurrently in separate workers
  // hit the same collisions (confirmed — leader-login and leader-scoring
  // racing on the same leader's TOTP factor). The suite is small; running it
  // fully sequentially costs seconds, not minutes, and removes this whole
  // class of flakiness instead of chasing it file by file.
  workers: 1,
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
  // Specs that authenticate as a leader/scout or award points mutate shared,
  // IP-keyed rate-limit state and/or write real ledger rows
  // (scout_credentials/ip_rate_limits/ledger). Excluded from every project
  // but 360-baseline: running the same login or award 4x in parallel across
  // breakpoint projects causes real collisions, not flakiness in the tests
  // themselves — confirmed while building Tasks 03 and 05. Each such spec
  // sets its own viewport via test.use() regardless of which project runs
  // it, so 360-baseline is just "run this once," not the actual rendered
  // width.
  projects: [
    { name: "360-baseline", use: { viewport: { width: 360, height: 640 } } },
    {
      name: "414-large-phone",
      use: { viewport: { width: 414, height: 896 } },
      testIgnore: ["**/*-login.spec.ts", "**/leader-scoring.spec.ts"],
    },
    {
      name: "768-tablet",
      use: { viewport: { width: 768, height: 1024 } },
      testIgnore: ["**/*-login.spec.ts", "**/leader-scoring.spec.ts"],
    },
    {
      name: "1024-leader-laptop",
      use: { ...devices["Desktop Chrome"], viewport: { width: 1024, height: 800 } },
      testIgnore: ["**/*-login.spec.ts", "**/leader-scoring.spec.ts"],
    },
  ],
});
