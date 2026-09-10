import { test, expect, type Page } from "@playwright/test";
import { TOTP, Secret } from "otpauth";
import pg from "pg";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/05-leader-scoring.md: the 15-second screen. Requires
// scripts/seed-e2e-fixtures.mjs to have been run against a live
// `supabase start` stack first (seeds a "today" session + 12-scout roster).
test.use({ viewport: { width: 375, height: 812 } });

// Serial, one worker: TOTP enrollment can only happen once per fresh DB —
// every test after the first reuses the same cached secret to answer the
// ordinary verify-totp challenge instead. fullyParallel (playwright.config)
// would otherwise run these in separate worker processes with no shared
// module state.
test.describe.configure({ mode: "serial" });

// Enrollment only happens once per fresh DB — the first test in this file
// to authenticate captures the secret here, so later tests (same leader,
// same factor, no reset in between) can compute a fresh code for the
// ordinary verify-totp challenge instead of needing to re-enroll.
let cachedTotpSecret: string | null = null;

async function fullyAuthenticateLeader(page: Page) {
  await page.goto("/leader/login");
  await page.getByLabel("Email").fill(FIXTURES.scoringLeaderEmail);
  await page.getByLabel("Password").fill(FIXTURES.scoringLeaderPassword);
  await page.getByRole("button", { name: "Sign in" }).click();
  await page.waitForURL(/\/leader\/(enroll-totp|verify-totp)$/, { timeout: 10000 });

  // Only enroll-totp ever shows the secret — don't block waiting for an
  // element that verify-totp never renders.
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
  await expect(page).toHaveURL(/\/leader\?session=/);
}

test("roster loads with zero taps when there is exactly one session today", async ({
  page,
}) => {
  await fullyAuthenticateLeader(page);
  await expect(page.getByText("Roster Scout 01")).toBeVisible();
});

test("selecting 12 scouts and confirming a tier writes 12 awards", async ({ page }) => {
  await fullyAuthenticateLeader(page);

  for (const name of Array.from(
    { length: 12 },
    (_, i) => `Roster Scout ${String(i + 1).padStart(2, "0")}`,
  )) {
    await page.getByRole("button", { name: new RegExp(name) }).click();
  }
  await expect(page.getByText("12 selected")).toBeVisible();

  await page.getByRole("button", { name: /Standard/ }).click();
  await page.getByRole("button", { name: "Confirm" }).click();

  // Optimistic UI: all 12 show "scored" without waiting for a page reload.
  await expect(page.getByText("✓ scored")).toHaveCount(12);
  // Selection clears and the confirm button disables again, ready for the
  // next batch — this is what "under 15 seconds, no navigation" depends on.
  await expect(page.getByText("Tap scouts to select")).toBeVisible();
});

test("a double-tap on confirm does not double-award", async ({ page }) => {
  await fullyAuthenticateLeader(page);

  const rosterScout03 = FIXTURES.rosterScoutIds[2];
  await page.getByRole("button", { name: /Roster Scout 03/ }).click();
  await page.getByRole("button", { name: /Minor/ }).click();

  const confirmButton = page.getByRole("button", { name: "Confirm" });
  // Dispatch two click events synchronously at the DOM level (closer to a
  // real double-tap than two sequential Playwright .click() calls, which
  // each wait for actionability and would just serialize behind whatever
  // disabled state has already committed by the second call). The actual
  // guard is a ref checked synchronously inside the click handler
  // (app/leader/scoring-screen.tsx) — not the button's `disabled`
  // attribute, since React doesn't necessarily commit that before a
  // same-tick second click would land. Verified here at the source of
  // truth (the ledger), not the DOM, since UI state alone can't
  // distinguish "one request fired" from "two fired, one still in
  // flight."
  await confirmButton.evaluate((el: HTMLButtonElement) => {
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
    el.dispatchEvent(new MouseEvent("click", { bubbles: true }));
  });
  await expect(page.getByText("Tap scouts to select")).toBeVisible();

  const pool = new pg.Pool({
    connectionString: "postgresql://postgres:postgres@127.0.0.1:54322/postgres",
  });
  try {
    const { rows } = await pool.query(
      "select count(*)::int as n from ledger where person_id = $1 and delta = 10",
      [rosterScout03],
    );
    expect(rows[0].n).toBe(1);
  } finally {
    await pool.end();
  }
});
