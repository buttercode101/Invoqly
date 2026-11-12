import { expect, test, type Page } from "@playwright/test";

async function createAccount(page: Page) {
  const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Multi Line QA");
  await page.getByLabel("Email address").fill("multi-line-" + suffix + "@example.com");
  await page.locator('input[type="password"]').fill("InvoqlySecurePassphrase!2026");
  const response = page.waitForResponse(r => r.url().includes("/api/auth/sign-up/email") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
}

test("guest can create and print multi-line invoices and quotations without an account", async ({ page }) => {
  await page.goto("/guest");
  await page.getByRole("button", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Customer name").fill("Guest Multi Customer");
  await page.getByLabel("Description").fill("Labour");
  await page.getByLabel("Unit price (ZAR)").fill("500.00");
  await page.getByRole("button", { name: "Add another line" }).click();
  await page.locator('input[name="extraDescription"]').fill("Materials");
  await page.locator('input[name="extraQuantity"]').fill("1");
  await page.locator('input[name="extraPrice"]').fill("2400.00");
  await page.getByRole("button", { name: "Create invoice" }).click();
  const invoiceRow = page.locator(".row").filter({ hasText: "Guest Multi Customer" });
  await expect(invoiceRow).toContainText("Labour +1 more lines");
  await expect(invoiceRow).toContainText(/2[\s\u00a0,]?900/);
  const invoicePopupPromise = page.waitForEvent("popup");
  await invoiceRow.getByRole("button", { name: "Print / PDF" }).click();
  const invoicePopup = await invoicePopupPromise;
  await expect(invoicePopup.locator("body")).toContainText("Labour");
  await expect(invoicePopup.locator("body")).toContainText("Materials");
  await invoicePopup.close();

  await page.getByRole("button", { name: "Quotes" }).click();
  await page.getByRole("button", { name: "New quote" }).click();
  await page.getByLabel("Customer name").fill("Guest Multi Quote");
  await page.getByLabel("Description").fill("Labour");
  await page.getByLabel("Unit price (ZAR)").fill("500.00");
  await page.getByRole("button", { name: "Add another line" }).click();
  await page.locator('input[name="extraDescription"]').fill("Materials");
  await page.locator('input[name="extraQuantity"]').fill("1");
  await page.locator('input[name="extraPrice"]').fill("2400.00");
  await page.getByRole("button", { name: "Create quotation" }).click();
  const quoteRow = page.locator(".row").filter({ hasText: "Guest Multi Quote" });
  await expect(quoteRow).toContainText("R");
  const quotePopupPromise = page.waitForEvent("popup");
  await quoteRow.getByRole("button", { name: "Print / PDF" }).click();
  const quotePopup = await quotePopupPromise;
  await expect(quotePopup.locator("body")).toContainText("Labour");
  await expect(quotePopup.locator("body")).toContainText("Materials");
  await quotePopup.close();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("invoqly.guest.workspace.v1") || "{}"));
  expect(stored.invoices[0].lineItems).toHaveLength(2);
  expect(stored.quotes[0].lineItems).toHaveLength(2);
  await expect(page.getByText("You're using Invoqly for free, without signing up.")).toBeVisible();
});

test("signed-in workspace creates, converts and reloads a multi-line quotation", async ({ page }) => {
  await createAccount(page);
  await page.locator(".nav-item").filter({ hasText: "Quotes" }).first().click();
  await page.getByRole("button", { name: "New quotation" }).click();
  await page.getByLabel("Customer or business name").fill("Cloud Multi Quote");
  await page.getByLabel("Scope of work / description").fill("Labour");
  await page.getByLabel("Quantity").fill("8");
  await page.getByLabel("Unit price").fill("500.00");
  await page.getByRole("button", { name: "Add another line" }).click();
  await page.locator(".extra-line-editor input").nth(0).fill("Materials");
  await page.locator(".extra-line-editor input").nth(1).fill("1");
  await page.locator(".extra-line-editor input").nth(2).fill("2400.00");
  await page.getByRole("button", { name: "Create quotation" }).click();

  const quoteRow = page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" });
  await expect(quoteRow).toContainText("Labour +1 more lines");
  await expect(quoteRow).toContainText(/6[\s\u00a0,]?400/);
  const printPromise = page.waitForEvent("popup");
  await quoteRow.getByTitle("Print quotation").click();
  const popup = await printPromise;
  await expect(popup.locator("body")).toContainText("Labour");
  await expect(popup.locator("body")).toContainText("Materials");
  await popup.close();

  await quoteRow.getByTitle("Mark as sent").click();
  await quoteRow.getByTitle("Accept quotation").click();
  await quoteRow.getByTitle("Convert to invoice").click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const invoiceRow = page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" });
  await expect(invoiceRow).toContainText("Labour +1 more lines");
  await page.reload();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  await expect(page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" })).toContainText("Labour +1 more lines");
});
