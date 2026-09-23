import { test, expect, type Page } from "@playwright/test";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/09-quests-board.md: leader authoring — tier is a fixed choice
// (no free-text point field), and publishing is refused until both locales
// exist. Serial + its own leader identity for the same reason as
// leader-scoring.spec.ts: WhatsApp setup only happens once per leader per
// DB, so every test after the first skips straight to verify-otp. Requires
// E2E_TEST_MODE=true so app/api/test-support/last-whatsapp-otp works (see
// e2e/leader-login.spec.ts).
test.use({ viewport: { width: 375, height: 812 } });
test.describe.configure({ mode: "serial" });

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

async function authenticateQuestLeader(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email").fill(FIXTURES.questAuthoringLeaderEmail);
  await page.getByLabel("Password").fill(FIXTURES.questAuthoringLeaderPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/leader\/(setup-whatsapp|verify-otp)$/, { timeout: 10000 });

  if (page.url().includes("/setup-whatsapp")) {
    await page
      .getByLabel("WhatsApp number")
      .fill(FIXTURES.questAuthoringLeaderWhatsAppNumber);
    await page.getByRole("button", { name: "Send code" }).click();
    await page.waitForURL(/\/leader\/verify-otp$/, { timeout: 10000 });
  }

  const code = await readLastOtpCode(page, FIXTURES.questAuthoringLeaderWhatsAppNumber);
  await page.getByLabel("6-digit code").fill(code);
  await page.getByRole("button", { name: "Confirm" }).click();
  await page.waitForURL(/\/leader\?session=/);
}

test("authoring UI offers no free-text point field", async ({ page }) => {
  await authenticateQuestLeader(page);
  await page.goto("/leader/quests/new");
  await expect(page.getByRole("spinbutton")).toHaveCount(0);
  await expect(page.getByText("minor · 10 pts")).toBeVisible();
  await expect(page.getByText("epic · 100 pts")).toBeVisible();
});

test("a new quest is created as an unpublished draft, then can be published once both locales exist", async ({
  page,
}) => {
  await authenticateQuestLeader(page);
  await page.goto("/leader/quests/new");
  await page.getByText("standard · 25 pts").click();
  await page.getByLabel("Title", { exact: true }).fill("E2E Authored Quest");
  await page
    .getByLabel("Description", { exact: true })
    .fill("A quest authored end to end.");
  await page.getByRole("button", { name: "Create quest" }).click();

  await expect(page).toHaveURL(/\/leader\/quests\/.+\/edit$/);
  await expect(page.getByText(/Draft — not yet visible/)).toBeVisible();

  // English-only: publish is refused with a friendly message, not a raw DB error.
  await page.getByRole("button", { name: "Publish" }).click();
  await expect(page.getByText(/Add both English and Arabic content/)).toBeVisible();

  await page.getByLabel("العنوان").fill("مهمة تجريبية");
  await page.getByLabel("الوصف").fill("مهمة تم إنشاؤها للاختبار.");
  await page.getByRole("button", { name: "Save changes" }).click();
  await page.getByRole("button", { name: "Publish" }).click();

  await expect(page.getByText(/Published — visible to scouts/)).toBeVisible();

  await page.goto("/leader/quests");
  await expect(page.getByText("E2E Authored Quest")).toBeVisible();
  await expect(page.getByText(/published/)).toBeVisible();
});
