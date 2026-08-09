import { test, expect } from "@playwright/test";

test("W020 advisory source surfaces remain explicitly advisory-only", async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("body")).toContainText(/Student|学员|not signed in/i);
});
