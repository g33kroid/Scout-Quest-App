import { test, expect } from "@playwright/test";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/03-auth.md: "E2E: full scout login on a mobile viewport."
// Requires scripts/seed-e2e-fixtures.mjs to have been run against a live
// `supabase start` stack first (docs/runbook.md).
test.use({ viewport: { width: 360, height: 640 } });

test("scout signs in with join code, nickname, and PIN", async ({ page }) => {
  await page.goto("/scout/login");

  await page.getByLabel("Join code").fill(FIXTURES.joinCode);
  await page.getByLabel("Your name").fill(FIXTURES.scoutNickname);
  await page.getByLabel("6-digit PIN").fill(FIXTURES.scoutPin);
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page).toHaveURL(/\/scout$/);
  await expect(page.getByText("Signed in.")).toBeVisible();
});

test("wrong PIN shows an error and does not sign in", async ({ page }) => {
  await page.goto("/scout/login");

  await page.getByLabel("Join code").fill(FIXTURES.joinCode);
  await page.getByLabel("Your name").fill(FIXTURES.scoutNickname);
  await page.getByLabel("6-digit PIN").fill("000000");
  await page.getByRole("button", { name: "Sign in" }).click();

  await expect(page.getByRole("alert")).toBeVisible();
  await expect(page).toHaveURL(/\/scout\/login$/);
});
