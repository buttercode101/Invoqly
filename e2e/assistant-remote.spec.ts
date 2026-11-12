import { expect, test } from "@playwright/test";

function contrastRatio(foreground: string, background: string) {
  const luminance = (value: string) => {
    const channels = value.match(/[\\d.]+/g)?.slice(0, 3).map(Number);
    if (!channels || channels.length !== 3) throw new Error("Unexpected computed colour: " + value);
    const [r, g, b] = channels.map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

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

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.screenshot({ path: "test-results/invoqly-ai-draft-desktop-1440.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "dark");
  const darkDraft = await page.evaluate(() => {
    const draft = document.querySelector(".assistant-draft");
    const title = draft?.querySelector("h2");
    const label = draft?.querySelector(".assistant-draft-row span");
    const value = draft?.querySelector(".assistant-draft-row b");
    const total = draft?.querySelector(".assistant-draft-total strong");
    const lineItem = draft?.querySelector(".assistant-line-item");
    const lineItemTitle = lineItem?.querySelector("b");
    const lineItemDetail = lineItem?.querySelector("span");
    return {
      background: draft ? getComputedStyle(draft).backgroundColor : "",
      title: title ? getComputedStyle(title).color : "",
      label: label ? getComputedStyle(label).color : "",
      value: value ? getComputedStyle(value).color : "",
      total: total ? getComputedStyle(total).color : "",
      lineItemTitle: lineItemTitle ? getComputedStyle(lineItemTitle).color : "",
      lineItemDetail: lineItemDetail ? getComputedStyle(lineItemDetail).color : ""
    };
  });
  expect(darkDraft.background).toBe("rgb(24, 34, 27)");
  expect(contrastRatio(darkDraft.title, darkDraft.background)).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(darkDraft.label, darkDraft.background)).toBeGreaterThanOrEqual(4.5);
  expect(contrastRatio(darkDraft.value, darkDraft.background)).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(darkDraft.total, darkDraft.background)).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(darkDraft.lineItemTitle, darkDraft.background)).toBeGreaterThanOrEqual(7);
  expect(contrastRatio(darkDraft.lineItemDetail, darkDraft.background)).toBeGreaterThanOrEqual(4.5);
  await page.screenshot({ path: "test-results/invoqly-ai-draft-dark-1440.png", fullPage: true });

  await page.setViewportSize({ width: 390, height: 844 });
  const mobileDimensions = await page.evaluate(() => ({
    viewport: document.documentElement.clientWidth,
    document: document.documentElement.scrollWidth
  }));
  expect(mobileDimensions.document).toBeLessThanOrEqual(mobileDimensions.viewport);
  await page.screenshot({ path: "test-results/invoqly-ai-draft-dark-mobile-390.png", fullPage: true });
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect(page.locator("html")).toHaveAttribute("data-theme", "light");
  await page.screenshot({ path: "test-results/invoqly-ai-draft-mobile-390.png", fullPage: true });

  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(page.getByRole("heading", { name: "Edit quotation draft" })).toBeVisible();
  await expect(page.getByLabel("Customer or business name")).toHaveValue(customer);
  await expect(page.getByLabel("Scope of work / description")).toHaveValue("Website maintenance");
  await expect(page.getByLabel("Quantity")).toHaveValue("1");
  await expect(page.getByLabel("Unit price")).toHaveValue("100.00");

  await page.setViewportSize({ width: 390, height: 844 });
  await page.screenshot({ path: "test-results/invoqly-ai-edit-form-mobile-390-top.png", fullPage: true });
  await page.setViewportSize({ width: 320, height: 720 });
  const editDimensions = await page.evaluate(() => ({ viewport: document.documentElement.clientWidth, document: document.documentElement.scrollWidth }));
  expect(editDimensions.document).toBeLessThanOrEqual(editDimensions.viewport);
  await page.getByLabel("Unit price").scrollIntoViewIfNeeded();
  await page.getByLabel("Unit price").fill("125.00");
  await page.getByRole("button", { name: "Create quotation" }).scrollIntoViewIfNeeded();
  await expect(page.getByRole("button", { name: "Create quotation" })).toBeVisible();
  await page.screenshot({ path: "test-results/invoqly-ai-edit-form-mobile-320-bottom.png", fullPage: true });
  await page.getByRole("button", { name: "Create quotation" }).click();

  const createdQuote = page.locator("tbody tr").filter({ hasText: customer });
  await expect(createdQuote).toBeVisible({ timeout: 20_000 });
  await expect(createdQuote).toContainText("Draft");
  await expect(createdQuote).toContainText(/125[,.]00/);
});
