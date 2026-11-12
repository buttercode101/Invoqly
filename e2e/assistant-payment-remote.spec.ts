import { expect, test } from "@playwright/test";
test.skip(process.env.RUN_REMOTE_AI_E2E !== "1", "Requires the live preview AI binding.");
test("AI invoice draft is reviewed, issued and paid", async ({ page }) => {
  test.setTimeout(150_000);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("AI Payment QA");
  await page.getByLabel("Email address").fill("ai-payment-" + Date.now() + "@example.com");
  await page.locator('input[type="password"]').first().fill("Invoqly-Preview-QA-2026!");
  const signupPromise = page.waitForResponse(response => response.url().includes("/api/auth/sign-up/email") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  const signup = await signupPromise;
  expect(signup.status(), "account signup must succeed").toBe(200);
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });
  await page.locator(".sidebar .nav-item").filter({ hasText: "AI Co-pilot" }).first().click();
  await page.getByRole("button", { name: "I understand — enable AI" }).click();
  await page.getByLabel("Ask your business co-pilot").fill("Prepare an invoice for customer Invoqly AI Payment QA. One line: One-off consulting, quantity 1, unit price ZAR 250.00, due 2026-12-12. Prepare the draft.");
  const aiResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/assistant") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send message" }).click();
  const aiResponse = await aiResponsePromise;
  const aiPayload = await aiResponse.json() as { reply?: string; draft?: unknown; error?: string };
  expect(aiResponse.status(), aiPayload.error ?? aiPayload.reply ?? "AI request must succeed").toBe(200);
  expect(aiPayload.draft, aiPayload.reply ?? "AI must return a reviewable invoice draft").toBeTruthy();
  await expect(page.getByRole("heading", { name: "Invoice draft" })).toBeVisible({ timeout: 20_000 });
  await page.getByRole("button", { name: "Edit details" }).click();
  await expect(page.getByRole("heading", { name: "Review invoice draft" })).toBeVisible();
  await page.getByLabel("Unit price").fill("275.00");
  await page.getByRole("button", { name: "Create invoice" }).click();
  await page.locator(".sidebar .nav-item").filter({ hasText: "Invoices" }).first().click();
  const invoice = page.locator("tbody tr").filter({ hasText: "Invoqly AI Payment QA" });
  await expect(invoice).toContainText("Draft");
  await invoice.getByTitle("Issue invoice").click();
  await expect(invoice).toContainText("Sent");
  await page.locator(".sidebar .nav-item").filter({ hasText: "Payments" }).first().click();
  await page.getByRole("button", { name: "Record payment" }).click();
  await page.getByLabel("Invoice").selectOption({ index: 0 });
  await page.getByLabel("Amount received").fill("275.00");
  await page.getByLabel("Date received").fill("2026-11-12");
  await page.getByRole("button", { name: "Save payment" }).click();
  await page.locator(".sidebar .nav-item").filter({ hasText: "Invoices" }).first().click();
  await expect(page.locator("tbody tr").filter({ hasText: "Invoqly AI Payment QA" })).toContainText("Paid");
});

test("execution mode requires explicit approval and records exactly one full settlement", async ({ page }) => {
  test.setTimeout(120_000);
  const customer = "Execution QA " + Date.now();
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill("Execution QA");
  await page.getByLabel("Email address").fill("execution-qa-" + Date.now() + "@example.com");
  await page.locator('input[type="password"]').first().fill("Invoqly-Execution-QA-2026!");
  const signupPromise = page.waitForResponse(response => response.url().includes("/api/auth/sign-up/email") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  const signup = await signupPromise;
  expect(signup.status(), "account signup must succeed").toBe(200);
  await expect(page).toHaveURL(/\/app$/, { timeout: 20_000 });

  await page.locator(".sidebar .nav-item").filter({ hasText: "Invoices" }).first().click();
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Bill to").selectOption({ label: "One-off customer / enter details" });
  await page.getByLabel("Customer name").fill(customer);
  await page.getByLabel("Description").fill("Execution mode acceptance");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price").fill("325.00");
  await page.getByRole("button", { name: "Create invoice" }).click();
  const invoice = page.locator("tbody tr").filter({ hasText: customer });
  await expect(invoice).toContainText("Draft");
  const invoiceNumber = (await invoice.locator("td").first().innerText()).trim().split(/\s+/)[0]!;
  await invoice.getByTitle("Issue invoice").click();
  await expect(invoice).toContainText("Sent");

  await page.locator(".sidebar .nav-item").filter({ hasText: "AI Co-pilot" }).first().click();
  await page.getByRole("button", { name: "I understand — enable AI" }).click();
  await page.getByRole("button", { name: "Execution mode · Off" }).click();
  const ask = page.getByLabel("Ask your business co-pilot");
  await ask.fill(`Mark invoice ${invoiceNumber} paid in full and record the payment.`);
  const executionResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/assistant") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send message" }).click();
  const executionResponse = await executionResponsePromise;
  const executionPayload = await executionResponse.json() as { reply?: string; execution?: unknown; error?: string };
  expect(executionResponse.status(), executionPayload.error ?? executionPayload.reply ?? "execution proposal request must succeed").toBe(200);
  expect(executionPayload.execution, executionPayload.reply ?? "AI must return an approval proposal").toBeTruthy();
  await expect(page.getByRole("heading", { name: "Record payment" })).toBeVisible({ timeout: 20_000 });
  await expect(page.getByText(invoiceNumber, { exact: true })).toBeVisible();
  await expect(page.getByText(customer, { exact: true })).toBeVisible();
  await expect(page.getByText("R 325,00").first()).toBeVisible();

  await page.getByRole("button", { name: "Cancel" }).click();
  await expect(page.getByText("Execution cancelled. No payment was recorded.")).toBeVisible();
  let workspace = await page.request.get("/api/workspace");
  let data = await workspace.json() as { workspace: { invoices: Array<{ id: string; number: string; status: string }>; payments: Array<{ invoiceId: string }> } };
  const cancelledInvoice = data.workspace.invoices.find(item => item.number === invoiceNumber);
  expect(cancelledInvoice?.status).toBe("Sent");
  expect(data.workspace.payments).toHaveLength(0);

  await ask.fill(`Mark invoice ${invoiceNumber} paid in full and record the payment.`);
  await page.getByRole("button", { name: "Send message" }).click();
  await expect(page.getByRole("heading", { name: "Record payment" })).toBeVisible({ timeout: 75_000 });
  const paymentResponsePromise = page.waitForResponse(response => response.url().endsWith("/api/workspace") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Confirm and record payment" }).click();
  const paymentResponse = await paymentResponsePromise;
  const paymentPayload = await paymentResponse.json() as { error?: string };
  expect(paymentResponse.status(), paymentPayload.error ?? "approved payment must be recorded successfully").toBe(200);
  await expect(page.getByText("Approved. The full payment has been recorded in your workspace.")).toBeVisible();
  workspace = await page.request.get("/api/workspace");
  data = await workspace.json();
  const paidInvoice = data.workspace.invoices.find(item => item.number === invoiceNumber);
  expect(paidInvoice?.status).toBe("Paid");
  expect(data.workspace.payments).toHaveLength(1);

  await ask.fill(`Mark invoice ${invoiceNumber} paid in full and record the payment again.`);
  const duplicateAssistantPromise = page.waitForResponse(response => response.url().endsWith("/api/assistant") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Send message" }).click();
  const duplicateAssistantResponse = await duplicateAssistantPromise;
  const duplicateAssistantPayload = await duplicateAssistantResponse.json() as { reply?: string; execution?: unknown };
  expect(duplicateAssistantResponse.status()).toBe(200);
  expect(duplicateAssistantPayload.execution).toBeFalsy();
  workspace = await page.request.get("/api/workspace");
  data = await workspace.json();
  expect(data.workspace.payments).toHaveLength(1);

  const invoiceId = data.workspace.invoices.find(item => item.number === invoiceNumber)?.id;
  expect(invoiceId).toBeTruthy();
  const duplicatePayment = await page.evaluate(async (id: string) => {
    const response = await fetch("/api/workspace", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        action: "create-payment", invoiceId: id, date: "2026-11-12", amountMinor: 32500,
        currency: "ZAR", method: "Manual", reference: "duplicate-settlement-guard"
      })
    });
    return { status: response.status };
  }, invoiceId!);
  expect(duplicatePayment.status).toBe(409);
  workspace = await page.request.get("/api/workspace");
  data = await workspace.json();
  expect(data.workspace.payments).toHaveLength(1);
});
