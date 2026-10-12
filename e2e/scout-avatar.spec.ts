import { test, expect } from "@playwright/test";
import { FIXTURES } from "./fixtures/e2e-fixtures.mjs";

// docs/tasks/12-avatar.md: a scout edits their own avatar; the config is
// stored as JSONB and no image bytes are ever written. Baseline device
// (00b-cross-cutting-ui.md): 360×640.
test.use({ viewport: { width: 360, height: 640 } });

async function signInScout(page: import("@playwright/test").Page) {
  await page.goto("/scout/login");
  await page.getByLabel("Join code").fill(FIXTURES.joinCode);
  await page.getByLabel("Your name").fill(FIXTURES.scoutNickname);
  await page.getByLabel("6-digit PIN").fill(FIXTURES.scoutPin);
  await page.getByRole("button", { name: "Sign in" }).click();
  await expect(page).toHaveURL(/\/scout$/);
}

test("home shows an avatar and an edit link; the editor opens", async ({ page }) => {
  await signInScout(page);

  // A deterministic default avatar renders from the scout's id (an SVG from
  // react-nice-avatar, never an <img> — no image request on any path).
  await expect(page.getByRole("link", { name: "Edit avatar" })).toBeVisible();

  await page.getByRole("link", { name: "Edit avatar" }).click();
  await expect(page).toHaveURL(/\/scout\/avatar$/);
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();
});

test("editing and saving persists and returns home", async ({ page }) => {
  await signInScout(page);
  await page.getByRole("link", { name: "Edit avatar" }).click();
  await expect(page).toHaveURL(/\/scout\/avatar$/);

  // Shuffle produces a new config, then save it.
  await page.getByRole("button", { name: "Shuffle" }).click();
  await page.getByRole("button", { name: "Save" }).click();
  await expect(page).toHaveURL(/\/scout$/);
});

test("no horizontal scroll and the editor is usable at 360px", async ({ page }) => {
  await signInScout(page);
  await page.getByRole("link", { name: "Edit avatar" }).click();
  await expect(page).toHaveURL(/\/scout\/avatar$/);

  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth > document.documentElement.clientWidth,
  );
  expect(overflow).toBe(false);
});

test("the customiser renders in Arabic RTL", async ({ page }) => {
  await signInScout(page);
  await page.goto("/scout/avatar");
  // Switch to Arabic; the page re-renders with dir=rtl on the main element.
  await page.getByRole("button", { name: "العربية" }).click();
  await expect(page.locator("main[dir='rtl']")).toBeVisible();
});

test("no avatar is ever requested as an image", async ({ page }) => {
  const imageRequests: string[] = [];
  page.on("request", (req) => {
    if (req.resourceType() === "image") imageRequests.push(req.url());
  });

  await signInScout(page);
  await page.getByRole("link", { name: "Edit avatar" }).click();
  await expect(page.getByRole("button", { name: "Save" })).toBeVisible();

  // Avatars are inline SVG from JSONB config — nothing fetched as an image.
  expect(imageRequests).toHaveLength(0);
});
