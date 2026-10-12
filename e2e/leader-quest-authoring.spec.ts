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
  const authoredQuestLink = page.getByRole("link", { name: /E2E Authored Quest/ });
  await expect(authoredQuestLink).toBeVisible();
  await expect(authoredQuestLink).toContainText("published");
});

// docs/tasks/11-bilingual.md: "the translate action produces an editable
// draft, not a saved record" / "editing the machine draft and saving
// persists the edit, not the original." E2E_TEST_MODE routes this through
// StubTranslator (lib/server/translator.ts) — deterministic, no real model
// call, prefixes with "[ar]"/"[en]" so the draft is distinguishable from
// hand-typed content.
test("translating fills the other language as an editable draft, and an edited draft is what gets saved", async ({
  page,
}) => {
  await authenticateQuestLeader(page);
  await page.goto("/leader/quests/new");
  await page.getByLabel("Title", { exact: true }).fill("E2E Translate Source");
  await page.getByLabel("Description", { exact: true }).fill("Source description.");

  await page.getByRole("button", { name: "Translate to Arabic" }).click();
  const arTitle = page.getByLabel("العنوان");
  await expect(arTitle).toHaveValue("[ar] E2E Translate Source");

  // Edit the machine draft before saving.
  await arTitle.fill("مهمة معدَّلة يدويًا");
  await page.getByRole("button", { name: "Create quest" }).click();
  await expect(page).toHaveURL(/\/leader\/quests\/.+\/edit$/);

  // The edited value persisted, not the untouched machine draft.
  await expect(page.getByLabel("العنوان")).toHaveValue("مهمة معدَّلة يدويًا");
});

// docs/tasks/11-bilingual.md: "no network call to the LLM occurs on any
// read path" — this is a plain list-page load, no translate action fired.
test("loading the quests list makes no network call to the translation service", async ({
  page,
}) => {
  await authenticateQuestLeader(page);
  const llmRequests: string[] = [];
  page.on("request", (request) => {
    if (new URL(request.url()).hostname === "api.anthropic.com") {
      llmRequests.push(request.url());
    }
  });

  await page.goto("/leader/quests");
  await expect(page.getByRole("heading", { name: "Quests" })).toBeVisible();
  expect(llmRequests).toEqual([]);
});

// docs/tasks/11-bilingual.md: RTL + locale persistence ("locale preference
// persists across devices for the same scout" — same mechanism for a
// leader, via people.locale).
test("switching to Arabic flips page direction and persists across a reload", async ({
  page,
}) => {
  await authenticateQuestLeader(page);
  await page.goto("/leader/quests");

  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.getByRole("heading", { name: "المهام" })).toBeVisible();
  await expect(page.locator('div[dir="rtl"]').first()).toBeVisible();

  await page.reload();
  await expect(page.getByRole("heading", { name: "المهام" })).toBeVisible();

  // Leave English for every later test/spec run against this leader.
  await page.getByRole("button", { name: "English" }).click();
  await expect(page.getByRole("heading", { name: "Quests" })).toBeVisible();
});
