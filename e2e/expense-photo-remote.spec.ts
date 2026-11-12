import { expect, test } from "@playwright/test";

test("expense capture supports private receipt photos and manual entry", async ({ page }) => {
  test.setTimeout(90_000);
  const email = "receipt-qa-" + Date.now() + "@example.com";
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Receipt QA");
  await page.getByLabel("Email address").fill(email);
  await page.locator('input[type="password"]').first().fill("Invoqly-Receipt-QA-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);

  await page.locator(".nav-item").filter({ hasText: "Expenses" }).first().click();
  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("Vendor or supplier").fill("Receipt QA Supplier");
  await page.getByLabel("Amount").fill("45.00");
  await page.getByLabel("Date").fill("2026-11-12");
  await page.locator('input[type="file"]').setInputFiles({
    name: "receipt.png",
    mimeType: "image/png",
    buffer: Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/jZsAAAAASUVORK5CYII=", "base64")
  });
  await expect(page.getByAltText("Receipt preview")).toBeVisible();
  await page.getByRole("button", { name: "Save expense" }).click();

  const receiptRow = page.locator("tbody tr").filter({ hasText: "Receipt QA Supplier" });
  await expect(receiptRow).toBeVisible({ timeout: 20_000 });
  const receiptLink = receiptRow.getByRole("link", { name: "View photo" });
  await expect(receiptLink).toBeVisible();
  const receiptUrl = await receiptLink.getAttribute("href");
  const receiptResponse = await page.evaluate(async url => {
    const response = await fetch(url!);
    return { status: response.status, type: response.headers.get("content-type"), bytes: (await response.arrayBuffer()).byteLength };
  }, receiptUrl);
  expect(receiptResponse.status).toBe(200);
  expect(receiptResponse.type).toContain("image/png");
  expect(receiptResponse.bytes).toBeGreaterThan(0);

  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("Vendor or supplier").fill("Manual QA Supplier");
  await page.getByLabel("Amount").fill("30.00");
  await page.getByLabel("Date").fill("2026-11-12");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "Manual QA Supplier" })).toBeVisible();
  await expect(page.locator("tbody tr").filter({ hasText: "Manual QA Supplier" }).getByText("—")).toBeVisible();
});
