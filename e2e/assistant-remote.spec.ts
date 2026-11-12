import { expect, test } from "@playwright/test";

test.skip(process.env.RUN_REMOTE_AI_E2E !== "1", "Requires the deployed preview Worker and its real AI binding.");

test("live AI co-pilot prepares an editable quotation and saves the user's approved changes", async ({ page }) => {
  test.setTimeout(120_000);
  const suffix = `${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
  const customer = "Invoqly Preview QA";
  const email = `ai-preview-${suffix}@example.com`;

  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("AI Preview QA");
  await page.getByLabel("Email address").fill(email);
  await page.locator('input[type="password"]').first().fill("Invoqly-Preview-QA-2026!");
  await page.getByRole("button", { name: "Create account" }).click();
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.getByRole("heading", { name: "Good morning." })).toBeVisible();

  await page.locator(".nav-item").filter({ hasText: "AI Co-pilot" }).first().click();
  await expect(page.getByRole("heading", { name: "Enable your AI co-pilot" })).toBeVisible();
  await page.getByRole("button", { name: "I understand — enable AI" }).click();
  await expect(page.getByRole("heading", { name: "What would you like to get done?" })).toBeVisible();

  await page.getByLabel("Ask your business co-pilot").fill(
    `Prepare a quotation for customer "${customer}". Create exactly one line item: "Website maintenance", quantity 1, unit price ZAR 100.00. The quotation is valid until 2026-12-12. Use ZAR. All details are supplied; prepare the editable quotation draft now.`
  );
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("heading", { name: "Quotation draft" })).toBeVisible({ timeout: 75_000 });
  await expect(page.getByText("Website maintenance", { exact: true })).toBeVisible();
  await expect(page.getByText("Net amount", { exact: true })).toBeVisible();
  await expect(page.getByText("VAT", { exact: true })).toBeVisible();
  await expect(page.getByText("Gross total", { exact: true })).toBeVisible();
  await expect(page.getByText("Out of scope · no VAT added", { exact: true })).toBeVisible();

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(mobileDimensions.document).toBeLessThanOrEqual(mobileDimensions.viewport);
  await page.screenshot({ path: "test-results/invoqly-ai-draft-mobile-390.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/invoqly-ai-draft-desktop-1440.png", fullPage: true });

  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  await expect(page.getByRole("heading", { name: "Invoices" })).toBeVisible();
  await page.locator(".nav-item").filter({ hasText: "AI Co-pilot" }).first().click();
  await expect(page.getByRole("heading", { name: "Quotation draft" })).toBeVisible();

  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(page.getByRole("heading", { name: "Edit quotation draft" })).toBeVisible();
  await expect(page.getByLabel("Customer or business name")).toHaveValue(customer);
  await expect(page.getByLabel("Scope of work / description")).toHaveValue("Website maintenance");
  await expect(page.getByLabel("Quantity")).toHaveValue("1");
  await expect(page.getByLabel("Unit price")).toHaveValue("100.00");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/invoqly-ai-edit-form-mobile-390.png", fullPage: true });
  await expect(page.getByRole("button", { name: "Create quotation" })).toBeInViewport();
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByLabel("Unit price").fill("125.00");
  await page.getByRole("button", { name: "Create quotation" }).click();

  const createdQuote = page.locator("tbody tr").filter({ hasText: customer });
  await expect(createdQuote).toBeVisible({ timeout: 20_000 });
  await expect(createdQuote).toContainText("Draft");
  await expect(createdQuote).toContainText(/125[,.]00/);
});
