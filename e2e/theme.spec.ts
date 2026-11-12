import { expect, test } from "@playwright/test";

test("light and dark themes toggle, persist and remain legible", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await page.evaluate(() => localStorage.getItem("invoqly.theme"))).toBe("dark");
  await expect(page.getByRole("heading", { name: "Your business, in good order." })).toBeVisible();
  await page.screenshot({ path: "test-results/invoqly-guest-dark-390.png", fullPage: true });
  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});