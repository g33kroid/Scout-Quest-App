import { test, expect } from "@playwright/test";
import { TOTP, Secret } from "otpauth";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/03-auth.md: leader email+password, then mandatory TOTP before
// any leader route is reachable. Requires scripts/seed-e2e-fixtures.mjs to
// have been run against a live `supabase start` stack first.
test.use({ viewport: { width: 360, height: 640 } });

async function signInWithPassword(page: import("@playwright/test").Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email").fill(FIXTURES.leaderEmail);
  await page.getByLabel("Password").fill(FIXTURES.leaderPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
}

test("a leader without TOTP enrolled is routed to enrollment, not any leader route", async ({
  page,
}) => {
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/leader\/enroll-totp$/);
  await expect(page.getByAltText("Authenticator app enrollment QR code")).toBeVisible();
});

test("completing TOTP enrollment reaches the leader home", async ({ page }) => {
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/leader\/enroll-totp$/);

  const secret = await page.locator("p.font-mono").textContent();
  expect(secret).toBeTruthy();

  const totp = new TOTP({ secret: Secret.fromBase32(secret!.trim()) });
  await page.getByLabel("6-digit code").fill(totp.generate());
  await page.getByRole("button", { name: "Confirm" }).click();

  // Task 05: /leader auto-resolves today's session and redirects there —
  // this leader's unit always has exactly one (seeded), so this is the
  // "zero taps" case, not a bare /leader landing page anymore.
  await expect(page).toHaveURL(/\/leader\?session=/);
  await expect(page.getByRole("button", { name: "Confirm" })).toBeVisible();
});

test("a direct hit on a leader route without a session redirects to login", async ({
  page,
}) => {
  await page.goto("/leader");
  await expect(page).toHaveURL(/\/leader\/login$/);
});
