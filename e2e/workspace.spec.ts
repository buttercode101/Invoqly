import { expect, test } from "@playwright/test";

test("client, invoice, payment status and expense survive a reload", async ({ page }) => {
  await page.goto("/");
  await expect(page.getByText("No sample customer or financial records have been inserted.")).toBeVisible();

  await page.getByRole("button", { name: /Add a client/ }).click();
  await page.getByLabel("Client or contact name").fill("Acme Services");
  await page.getByLabel("Business name").fill("Acme Services Ltd");
  await page.getByLabel("Email address").fill("accounts@acme.example");
  await page.getByRole("button", { name: "Save client" }).click();
  await expect(page.getByRole("heading", { name: "Acme Services" })).toBeVisible();

  await page.getByRole("button", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Bill to").selectOption({ label: "Acme Services" });
  await page.getByLabel("Description").fill("Product design");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit price").fill("1250.50");
  await page.getByRole("button", { name: "Create invoice" }).click();

  const invoiceRow = page.locator("tbody tr").filter({ hasText: "Acme Services" });
  await expect(invoiceRow).toContainText("Draft");
  await invoiceRow.getByTitle("Mark as sent").click();
  await expect(invoiceRow).toContainText("Sent");
  await invoiceRow.getByTitle("Mark as paid").click();
  await expect(invoiceRow).toContainText("Paid");

  await page.getByRole("button", { name: "Expenses" }).click();
  await page.getByRole("button", { name: "Record expense" }).click();
  await page.getByLabel("Vendor or supplier").fill("Cloud hosting");
  await page.getByLabel("Amount").fill("350.75");
  await page.getByLabel("Currency").selectOption("ZAR");
  await page.getByLabel("Category").selectOption("Software");
  await page.getByRole("button", { name: "Save expense" }).click();
  await expect(page.getByText("Cloud hosting")).toBeVisible();

  await page.reload();
  await page.getByRole("button", { name: "Clients" }).click();
  await expect(page.getByRole("heading", { name: "Acme Services" })).toBeVisible();
  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.locator("tbody tr").filter({ hasText: "Acme Services" })).toContainText("Paid");
  await page.getByRole("button", { name: "Expenses" }).click();
  await expect(page.getByText("Cloud hosting")).toBeVisible();
});

test("legacy browser data migrates to the current storage key", async ({ page }) => {
  await page.addInitScript(() => {
    localStorage.setItem("invoqly.workspace.v1", JSON.stringify({
      businessName: "Legacy Studio",
      currency: "ZAR",
      locale: "en-ZA",
      clients: [],
      invoices: [],
      expenses: [],
    }));
  });
  await page.goto("/");
  await expect(page.getByText("Legacy Studio")).toBeVisible();
  await expect.poll(() => page.evaluate(() => localStorage.getItem("invoqly.workspace.v2"))).not.toBeNull();
  expect(await page.evaluate(() => localStorage.getItem("invoqly.workspace.v1"))).toBeNull();
});

for (const width of [320, 375, 768, 1120]) {
  test(`workspace has no horizontal overflow at ${width}px`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto("/");
    await expect(page.locator("main.shell")).toBeVisible();
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth,
    }));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  });
}
