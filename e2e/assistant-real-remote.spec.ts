import { expect, test } from "@playwright/test";

test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Requires the deployed Cloudflare Workers AI preview.");
test.setTimeout(120_000);

test("real Workers AI prepares, reviews, issues and pays a priced invoice", async ({ page }) => {
  const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Remote AI QA");
  await page.getByLabel("Email address").fill("remote-ai-" + suffix + "@example.com");
  await page.locator('input[type="password"]').fill("InvoqlySecurePassphrase!2026");
  const signup = page.waitForResponse(response => response.url().includes("/api/auth/sign-up/email") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await signup).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);

  await page.locator(".nav-item").filter({ hasText: "AI Co-pilot" }).first().click();
  await page.getByRole("button", { name: "I understand — enable AI" }).click();
  await expect(page.getByLabel("Ask the Invoqly co-pilot")).toBeVisible();

  await page.getByLabel("Ask the Invoqly co-pilot").fill(
    "Create an invoice for Remote AI Draft Customer for 2 hours of design work at R1,250.00 per hour. Use ZAR."
  );
  await page.getByRole("button", { name: "Send message" }).click();

  await expect(page.getByRole("heading", { name: "Invoice draft" })).toBeVisible({ timeout: 90_000 });
  await expect(page.getByLabel("Review customer name")).toHaveValue("Remote AI Draft Customer");
  await expect(page.locator(".assistant-draft-total")).toContainText(/2.500/);
  await expect(page.locator(".nav-item").filter({ hasText: "Invoices" }).first()).toContainText("0");
  await page.screenshot({ path: "test-results/ai-real-workers-draft.png", fullPage: true });

  await page.getByRole("button", { name: "Approve and create" }).click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const invoice = page.locator("tbody tr").filter({ hasText: "Remote AI Draft Customer" });
  await expect(invoice).toContainText(/2.500/);
  await expect(invoice).toContainText("Draft");

  // Verify the approved AI draft remains an ordinary invoice through issue and payment.
  await invoice.getByTitle("Issue invoice").click();
  await expect(invoice).toContainText("Sent");
  await page.locator(".nav-item").filter({ hasText: "Payments" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Invoice").selectOption({ index: 0 });
  await page.getByLabel("Amount received").fill("2500.00");
  const receivedDate = await page.evaluate(() => {
    const date = new Date();
    return [date.getFullYear(), String(date.getMonth() + 1).padStart(2, "0"), String(date.getDate()).padStart(2, "0")].join("-");
  });
  await page.getByLabel("Date received").fill(receivedDate);
  await page.getByRole("button", { name: "Save payment" }).click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  await expect(page.locator("tbody tr").filter({ hasText: "Remote AI Draft Customer" })).toContainText("Paid");
});
