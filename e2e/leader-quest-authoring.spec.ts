import { test, expect, type Page } from "@playwright/test";
import { TOTP, Secret } from "otpauth";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/09-quests-board.md: leader authoring — tier is a fixed choice
// (no free-text point field), and publishing is refused until both locales
// exist. Serial + its own leader identity for the same reason as
// leader-scoring.spec.ts: fresh TOTP enrollment only happens once per leader
// per DB, so every test after the first reuses the cached secret.
test.use({ viewport: { width: 375, height: 812 } });
test.describe.configure({ mode: "serial" });

let cachedTotpSecret: string | null = null;

async function authenticateQuestLeader(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email").fill(FIXTURES.questAuthoringLeaderEmail);
  await page.getByLabel("Password").fill(FIXTURES.questAuthoringLeaderPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/leader\/(enroll-totp|verify-totp)$/, { timeout: 10000 });

  const secretLocator = page.locator("p.font-mono");
  if (await secretLocator.count()) {
    cachedTotpSecret = (await secretLocator.textContent())?.trim() ?? null;
  }
  if (!cachedTotpSecret) {
    throw new Error(
      "no known TOTP secret for this leader — run this spec against a freshly reset DB",
    );
  }

  const totp = new TOTP({ secret: Secret.fromBase32(cachedTotpSecret) });
  await page.getByLabel("6-digit code").fill(totp.generate());
  await page.getByRole("button", { name: /Confirm|Verify/ }).click();
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
