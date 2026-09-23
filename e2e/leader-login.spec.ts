import { test, expect, type Page } from "@playwright/test";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/03-auth.md: leader email+password, then a mandatory
// WhatsApp-delivered OTP before any leader route is reachable — replaced
// authenticator-app TOTP after Task 03 originally shipped (see
// lib/server/leader-auth.ts). Requires scripts/seed-e2e-fixtures.mjs to
// have been run against a live `supabase start` stack first, and
// E2E_TEST_MODE=true so app/api/test-support/last-whatsapp-otp works.
test.use({ viewport: { width: 360, height: 640 } });

async function signInWithPassword(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email").fill(FIXTURES.leaderEmail);
  await page.getByLabel("Password").fill(FIXTURES.leaderPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
}

async function readLastOtpCode(page: Page, whatsappNumber: string): Promise<string> {
  const response = await page.request.get(
    `/api/test-support/last-whatsapp-otp?to=${encodeURIComponent(whatsappNumber)}`,
  );
  const body = (await response.json()) as { code: string | null };
  if (!body.code) {
    throw new Error(`no captured WhatsApp OTP for ${whatsappNumber}`);
  }
  return body.code;
}

test("a leader without a WhatsApp number on file is routed to setup, not any leader route", async ({
  page,
}) => {
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/leader\/setup-whatsapp$/);
  await expect(page.getByLabel("WhatsApp number")).toBeVisible();
});

test("setting up WhatsApp and entering the code reaches the leader home", async ({
  page,
}) => {
  await signInWithPassword(page);
  await expect(page).toHaveURL(/\/leader\/setup-whatsapp$/);

  await page.getByLabel("WhatsApp number").fill(FIXTURES.leaderWhatsAppNumber);
  await page.getByRole("button", { name: "Send code" }).click();

  await expect(page).toHaveURL(/\/leader\/verify-otp$/);
  const code = await readLastOtpCode(page, FIXTURES.leaderWhatsAppNumber);
  await page.getByLabel("6-digit code").fill(code);
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
