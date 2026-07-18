import { expect, test } from "@playwright/test";

test("discover surface is responsive and keyboard command palette opens", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByRole("heading", { name: /Find the right place/i })).toBeVisible();
  await page.keyboard.press(process.platform === "darwin" ? "Meta+K" : "Control+K");
  await expect(page.getByRole("dialog", { name: /command/i })).toBeVisible();
});

test("forge workspace exposes grounded discovery UI", async ({ page }) => {
  await page.goto("/forge");
  await expect(page.getByRole("heading", { name: /KOBI Agent/i })).toBeVisible();
  await expect(page.getByText(/No hallucinated live links/i)).toBeVisible();
});

test("reduced motion keeps core navigation usable", async ({ page }) => {
  await page.emulateMedia({ reducedMotion: "reduce" });
  await page.goto("/");
  await page.getByRole("link", { name: /Projects/i }).first().click();
  await expect(page).toHaveURL(/\/projects/);
});
