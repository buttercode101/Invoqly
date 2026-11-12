import { expect, test, type Locator, type Page } from "@playwright/test";


async function expectPdfPreview(frame: Locator) {
  await expect.poll(() => frame.getAttribute("src")).toMatch(/^blob:/);
  const pdf = await frame.evaluate(async iframe => {
    const source = iframe.getAttribute("src");
    if (!source) return null;
    const response = await fetch(source);
    const bytes = new Uint8Array(await response.arrayBuffer());
    return {
      status: response.status,
      contentType: response.headers.get("content-type"),
      signature: new TextDecoder().decode(bytes.slice(0, 8)),
      size: bytes.byteLength
    };
  });
  expect(pdf).not.toBeNull();
  expect(pdf!.status).toBe(200);
  expect(pdf!.contentType).toContain("application/pdf");
  expect(pdf!.signature).toBe("%PDF-1.4");
  expect(pdf!.size).toBeGreaterThan(500);
}

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
  const invoiceRow = page.getByText("Guest Multi Customer").locator("xpath=../..");
  await expect(invoiceRow).toContainText("Labour +1 more line");
  await expect(invoiceRow).toContainText(/2[\s\u00a0,]?900/);
  await invoiceRow.getByRole("button", { name: "Preview / PDF" }).click();
  const invoicePreview = page.getByRole("dialog", { name: /Invoice ·/ });
  await expect(invoicePreview).toBeVisible();
  await expect(invoicePreview.locator("iframe")).toBeVisible();
  await expectPdfPreview(invoicePreview.locator("iframe"));
  await expect(invoicePreview.getByLabel("Document style")).toHaveValue("modern");
  await invoicePreview.getByRole("button", { name: "Close PDF preview" }).click();

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
  const quoteRow = page.getByText("Guest Multi Quote").locator("xpath=../..");
  await expect(quoteRow).toContainText("R");
  await quoteRow.getByRole("button", { name: "Preview / PDF" }).click();
  const quotePreview = page.getByRole("dialog", { name: /Quotation ·/ });
  await expect(quotePreview).toBeVisible();
  await expect(quotePreview.locator("iframe")).toBeVisible();
  await expectPdfPreview(quotePreview.locator("iframe"));
  await quotePreview.getByLabel("Document style").selectOption("classic");
  await expect(quotePreview.getByLabel("Document style")).toHaveValue("classic");
  await quotePreview.getByRole("button", { name: "Close PDF preview" }).click();

  const stored = await page.evaluate(() => JSON.parse(localStorage.getItem("invoqly.guest.workspace.v1") || "{}"));
  expect(stored.invoices[0].lineItems).toHaveLength(2);
  expect(stored.quotes[0].lineItems).toHaveLength(2);
  await expect(page.getByText("NO ACCOUNT REQUIRED")).toBeVisible();
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
  await expect(quoteRow).toContainText("Labour +1 more line");
  await expect(quoteRow).toContainText(/6[\s\u00a0,]?400/);
  await quoteRow.getByTitle("Print quotation").click();
  const popup = page.getByRole("dialog", { name: /Quotation ·/ });
  await expect(popup).toBeVisible();
  await expect(popup.locator("iframe")).toBeVisible();
  await popup.getByRole("button", { name: "Close PDF preview" }).click();

  await quoteRow.getByTitle("Mark as sent").click();
  await quoteRow.getByTitle("Accept quotation").click();
  await quoteRow.getByTitle("Convert to invoice").click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const invoiceRow = page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" });
  await expect(invoiceRow).toContainText("Labour +1 more line");
  await page.reload();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const persistedInvoice = page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" });
  await expect(persistedInvoice).toContainText("Labour +1 more line");
  await expect(persistedInvoice).toContainText(/6[\s\u00a0,]?400/);

  // Issue the converted invoice, then prove payment validation uses all lines.
  await persistedInvoice.getByTitle("Issue invoice").click();
  await expect(persistedInvoice).toContainText("Sent");
  await page.locator(".nav-item").filter({ hasText: "Payments" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount received").fill("5000.00");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const partiallyPaid = page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" });
  await expect(partiallyPaid).toContainText("Partially paid");
  await expect(partiallyPaid).toContainText(/1[\s\u00a0,]?400/);
  await page.locator(".nav-item").filter({ hasText: "Payments" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount received").fill("1400.00");
  await page.getByRole("button", { name: "Save payment" }).click();
  await expect(page.getByRole("dialog")).not.toBeVisible();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const fullyPaid = page.locator("tbody tr").filter({ hasText: "Cloud Multi Quote" });
  await expect(fullyPaid).toContainText("Paid");
  await expect(fullyPaid).toContainText(/R?0[.,]00/);
});
