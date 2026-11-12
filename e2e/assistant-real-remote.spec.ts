import { expect, test } from "@playwright/test";

test.skip(!process.env.PLAYWRIGHT_BASE_URL, "Requires the deployed Cloudflare Workers AI preview.");
test.setTimeout(120_000);

test("real Workers AI prepares a priced invoice draft that is reviewed before saving", async ({ page }) => {
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
  await expect(page.locator(".assistant-draft-total")).toContainText(/2[\\s\\u00a0]?500/);
  await expect(page.locator(".nav-item").filter({ hasText: "Invoices" }).first()).toContainText("0");
  await page.screenshot({ path: "test-results/ai-real-workers-draft.png", fullPage: true });

  await page.getByRole("button", { name: "Approve and create" }).click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  const invoice = page.locator("tbody tr").filter({ hasText: "Remote AI Draft Customer" });
  await expect(invoice).toContainText(/2[\\s\\u00a0]?500/);
  await expect(invoice).toContainText("Draft");
});
