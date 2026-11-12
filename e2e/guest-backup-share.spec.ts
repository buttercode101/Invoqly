import { expect, test } from "@playwright/test";

test("guest can create, share, back up and restore an invoice without an account", async ({ page, context }) => {
  await context.grantPermissions(["clipboard-read", "clipboard-write"]);
  await page.addInitScript(() => {
    Object.defineProperty(navigator, "share", { configurable: true, value: undefined });
  });
  await page.goto("/guest");
  await page.getByRole("button", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Customer name").fill("Backup Share QA");
  await page.getByLabel("Description").fill("Monthly support");
  await page.getByLabel("Unit price (ZAR)").fill("850.00");
  await page.getByLabel("Due date").fill("2026-12-01");
  await page.getByRole("button", { name: "Create invoice" }).click();
  const invoice = page.getByText(/Backup Share QA/).first();
  await expect(invoice).toBeVisible();

  await page.getByRole("button", { name: "Share" }).first().click();
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("INV-0001");
  await expect.poll(() => page.evaluate(() => navigator.clipboard.readText())).toContain("R850");

  const downloadPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: "Export backup" }).click();
  const download = await downloadPromise;
  const backupPath = await download.path();
  expect(backupPath).toBeTruthy();

  await page.evaluate(() => localStorage.removeItem("invoqly.guest.workspace.v1"));
  await page.reload();
  await expect(page.getByText("No invoices yet. Create one when you're ready.")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.locator('input[type="file"]').last().setInputFiles(backupPath!);
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.getByText(/Backup Share QA/)).toBeVisible();
});