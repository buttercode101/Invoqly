import { expect, test } from "@playwright/test";

test("AI invoice draft can be edited, saved, issued and paid without bypassing review", async ({ page }) => {
  const suffix = Date.now() + "-" + Math.random().toString(36).slice(2, 7);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("AI Review QA");
  await page.getByLabel("Email address").fill("ai-review-" + suffix + "@example.com");
  await page.locator('input[type="password"]').fill("InvoqlySecurePassphrase!2026");
  const signup = page.waitForResponse(response => response.url().includes("/api/auth/sign-up/email") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await signup).status()).toBe(200);
  await expect(page).toHaveURL(/\\/app$/);

  await page.locator(".nav-item").filter({ hasText: "AI Co-pilot" }).first().click();
  await page.getByRole("button", { name: "I understand — enable AI" }).click();
  await expect(page.getByLabel("Ask the Invoqly co-pilot")).toBeVisible();

  await page.route("**/api/assistant", async route => {
    if (route.request().method() !== "POST") return route.continue();
    await route.fulfill({
      status: 200,
      contentType: "application/json",
      body: JSON.stringify({
        reply: "I prepared an invoice draft for review. Nothing has been saved.",
        draft: {
          type: "create_invoice",
          data: {
            customerName: "AI Draft Customer", customerEmail: "", customerCompany: "",
            description: "Design service", quantity: 1, unitPriceMinor: 100_000,
            lineItems: [{ description: "Design service", quantity: 1, unitPriceMinor: 100_000 }],
            currency: "ZAR", dueDate: "2026-12-01", saveContact: false
          },
          lineItems: [{ description: "Design service", quantity: 1, unitPriceMinor: 100_000, lineTotalMinor: 100_000 }],
          totalMinor: 100_000, currency: "ZAR"
        }
      })
    });
  });

  await page.getByLabel("Ask the Invoqly co-pilot").fill("Create an invoice for AI Draft Customer for design service.");
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByLabel("Review customer name")).toHaveValue("AI Draft Customer");
  await expect(page.getByLabel("Review line 1 description")).toHaveValue("Design service");
  await expect(page.locator(".assistant-draft-total")).toContainText(/1[\\s\\u00a0]?000/);

  await page.getByLabel("Review customer name").fill("Reviewed and Approved Customer");
  await page.getByLabel("Review line 1 description").fill("Approved design retainer");
  await page.getByLabel("Review line 1 quantity").fill("2");
  await page.getByLabel("Review line 1 unit price").fill("1250.00");
  await page.getByLabel("Review document date").fill("2026-12-15");
  await expect(page.locator(".assistant-draft-total")).toContainText(/2[\\s\\u00a0]?500/);
  await page.getByRole("button", { name: "Approve and create" }).click();
  await expect(page.getByText("Approved and saved. The reviewed document is now in your workspace.")).toBeVisible();

  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  let invoice = page.locator("tbody tr").filter({ hasText: "Reviewed and Approved Customer" });
  await expect(invoice).toContainText("Approved design retainer");
  await expect(invoice).toContainText(/2[\\s\\u00a0]?500/);
  await invoice.getByTitle("Issue invoice").click();
  await expect(invoice).toContainText("Sent");

  await page.locator(".nav-item").filter({ hasText: "Payments" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount received").fill("1000.00");
  await page.getByRole("button", { name: "Save payment" }).click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  invoice = page.locator("tbody tr").filter({ hasText: "Reviewed and Approved Customer" });
  await expect(invoice).toContainText("Partially paid");
  await page.locator(".nav-item").filter({ hasText: "Payments" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Amount received").fill("1500.00");
  await page.getByRole("button", { name: "Save payment" }).click();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  invoice = page.locator("tbody tr").filter({ hasText: "Reviewed and Approved Customer" });
  await expect(invoice).toContainText("Paid");
  await page.reload();
  await page.locator(".nav-item").filter({ hasText: "Invoices" }).first().click();
  await expect(page.locator("tbody tr").filter({ hasText: "Reviewed and Approved Customer" })).toContainText("Paid");
});
