import { test, expect } from "@playwright/test";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/09-quests-board.md + docs/tasks/10-journal.md: the scout board
// states and the journal render from the same seeded quests
// (scripts/seed-e2e-fixtures.mjs) — one published+available quest, and one
// published+locked quest naming its unmet prerequisite.
test.use({ viewport: { width: 360, height: 640 } });

async function signInScout(page: import("@playwright/test").Page) {
  await page.goto("/scout/login");
  await page.getByLabel("Join code").fill(FIXTURES.joinCode);
  await page.getByLabel("Your name").fill(FIXTURES.scoutNickname);
  await page.getByLabel("6-digit PIN").fill(FIXTURES.scoutPin);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/scout$/);
}

test("home screen shows no leaderboard position above the fold", async ({ page }) => {
  await signInScout(page);
  await expect(page.getByText("Streak")).toBeVisible();
  // Standings is a tap away, not the landing content.
  await expect(page.getByRole("link", { name: "Standings" })).toBeVisible();
  await expect(page.getByText(/rank|position|#\d/i)).toHaveCount(0);
});

test("journal lists an available quest under Active and a locked one naming its prerequisite", async ({
  page,
}) => {
  await signInScout(page);
  await page.getByRole("link", { name: "Journal" }).click();
  await expect(page).toHaveURL(/\/scout\/journal$/);

  const active = page.getByRole("region", { name: "Active" });
  await expect(active.getByText(FIXTURES.availableQuestTitle)).toBeVisible();

  const locked = page.getByRole("region", { name: "Locked" });
  await expect(locked.getByText(FIXTURES.lockedQuestTitle)).toBeVisible();
  await expect(locked.getByText(new RegExp(FIXTURES.prereqQuestTitle))).toBeVisible();
});
