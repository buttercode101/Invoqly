import { expect, test, type Page } from "@playwright/test";

async function createAccount(page: Page) {
  const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("VAT Profile QA");
  await page.getByLabel("Email address").fill("vat-profile-" + suffix + "@example.com");
  await page.locator('input[type="password"]').fill("InvoqlySecurePassphrase!2026");
  const response = page.waitForResponse(r => r.url().includes("/api/auth/sign-up/email") && r.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await response).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
}

test("VAT-registered workspace calculates and preserves VAT on a quotation converted to an invoice", async ({ page }) => {
  await createAccount(page);
  await page.locator(".nav-item").filter({ hasText: "Settings" }).first().click();
  await page.getByLabel("My business is registered for VAT").check();
  await page.getByLabel("SARS VAT registration number").fill("4123456789");
  await page.getByLabel("Business address").fill("10 QA Street, Gqeberha, 6001");
  await page.getByRole("button", { name: "Save settings" }).click();
  await expect(page.getByText("Connected · Cloud sync enabled")).toBeVisible();

  await page.locator(".nav-item").filter({ hasText: "Quotes" }).first().click();
  await page.getByRole("button", { name: "New quotation" }).click();
  await page.getByLabel("Customer or business name").fill("VAT Test Customer");
  await page.getByLabel("Scope of work / description").fill("Professional services");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price").fill("115.00");
  await page.getByLabel("VAT treatment").selectOption("standard");
  await page.getByLabel("Entered prices").selectOption("inclusive");
  await expect(page.locator(".invoice-total-preview")).toContainText(/Net.*100.*VAT.*15/);
  await expect(page.locator(".invoice-total-preview")).toContainText(/115/);
  await page.getByRole("button", { name: "Create quotation" }).click();

  const quoteRow = page.locator("tbody tr").filter({ hasText: "VAT Test Customer" });
  await expect(quoteRow).toContainText(/115/);
  const quotePopupPromise = page.waitForEvent("popup");
  await quoteRow.getByTitle("Print quotation").click();
  const quotePopup = await quotePopupPromise;
  await expect(quotePopup.locator("body")).toContainText("VAT registration no: 4123456789");
  await expect(quotePopup.locator("body")).toContainText("VAT:");
  await quotePopup.close();

  const snapshot = await page.evaluate(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    return (await response.json() as { workspace: any }).workspace;
  });
  const savedQuote = snapshot.quotes.find((quote: any) => quote.customerName === "VAT Test Customer");
  expect(snapshot.vatRegistered).toBe(true);
  expect(savedQuote.lineItems[0]).toMatchObject({
    taxTreatment: "standard",
    priceMode: "inclusive",
    taxRateBasisPoints: 1500
  });

  await quoteRow.getByTitle("Mark as sent").click();
  await expect(quoteRow).toContainText("Sent");
  await quoteRow.getByTitle("Accept quotation").click();
  await expect(quoteRow).toContainText("Accepted");
  await quoteRow.getByTitle("Convert to invoice").click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const invoiceRow = page.locator("tbody tr").filter({ hasText: "VAT Test Customer" });
  await expect(invoiceRow).toContainText(/115/);
  const converted = await page.evaluate(async () => {
    const response = await fetch("/api/workspace", { cache: "no-store" });
    return (await response.json()).workspace;
  });
  const savedInvoice = converted.invoices.find((invoice: any) => invoice.customerName === "VAT Test Customer");
  expect(savedInvoice.lineItems[0]).toMatchObject({
    taxTreatment: "standard",
    priceMode: "inclusive",
    taxRateBasisPoints: 1500
  });
});
