import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_REMOTE_RECEIPT_E2E !== "1", "Requires Cloudflare preview R2 storage.");

test("expense receipt photo uploads and remains available after reload", async ({ page }) => {
  await page.setViewportSize({ width: 390, height: 844 });
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Receipt QA");
  await page.getByLabel("Email address").fill("receipt-qa-" + Date.now() + "@example.com");
  await page.locator('input[type="password"]').first().fill("Invoqly-Receipt-QA-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await page.locator(".nav-item").filter({ hasText: "Expenses" }).first().click();
  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("Vendor or supplier").fill("Receipt photo test supplier");
  await page.getByLabel("Amount").fill("149.99");
  await page.getByLabel("Currency").selectOption("ZAR");
  await page.getByLabel("Category").selectOption("Office");
  await page.locator('input[type="file"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/a5sAAAAASUVORK5CYII=", "base64")
  });
  await expect(page.getByRole("img", { name: "Receipt preview" })).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByRole("link", { name: /View (?:receipt )?photo/ }).first()).toBeVisible({ timeout: 20_000 });
  await page.reload();
  await page.locator(".nav-item").filter({ hasText: "Expenses" }).first().click();
  const receiptLink = page.getByRole("link", { name: /View (?:receipt )?photo/ }).first();
  await expect(receiptLink).toBeVisible();
  const href = await receiptLink.getAttribute("href");
  expect(href).toContain("/api/expenses/receipt?key=");
  const [popup] = await Promise.all([page.waitForEvent("popup"), receiptLink.click()]);
  await popup.waitForLoadState();
  await expect.poll(() => popup.evaluate(() => document.contentType)).toBe("image/png");
  await popup.close();

  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("Vendor or supplier").fill("Manual entry QA supplier");
  await page.getByLabel("Amount").fill("30.00");
  await page.getByLabel("Currency").selectOption("ZAR");
  await page.getByLabel("Category").selectOption("Office");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.locator("tbody").getByText("Manual entry QA supplier", { exact: true })).toBeVisible();
  await expect(page.getByRole("link", { name: /View (?:receipt )?photo/ })).toHaveCount(1);
});
