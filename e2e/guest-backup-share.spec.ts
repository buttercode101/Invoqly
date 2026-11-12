import { expect, test } from "@playwright/test";

test("guest can create, share a PDF, back up and restore an invoice without an account", async ({ page, context }) => {
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
  await expect(page.getByText(/Backup Share QA/).first()).toBeVisible();

  await page.getByRole("button", { name: "Preview PDF" }).first().click();
  const preview = page.getByRole("dialog", { name: "Invoice · INV-0001" });
  await expect(preview).toBeVisible();
  await expect(preview.getByTitle("Final PDF document preview")).toBeVisible();
  const shareDownloadPromise = page.waitForEvent("download");
  await preview.getByRole("button", { name: "Share PDF" }).click();
  const shareDownload = await shareDownloadPromise;
  expect(shareDownload.suggestedFilename()).toBe("INV-0001.pdf");
  await expect(page.locator("p[role='alert']")).toContainText("This browser cannot share PDF attachments directly");
  await preview.getByRole("button", { name: "Close PDF preview" }).click();

  const backupPromise = page.waitForEvent("download");
  await page.getByRole("button", { name: /Export backup/ }).click();
  const backup = await backupPromise;
  expect(backup.suggestedFilename()).toBe("invoqly-guest-backup.json");
  const backupPath = await backup.path();
  expect(backupPath).toBeTruthy();

  await page.evaluate(() => localStorage.removeItem("invoqly.guest.workspace.v1"));
  await page.reload();
  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.getByText("No invoices yet. Create one when you're ready.")).toBeVisible();
  await page.getByRole("button", { name: "Settings" }).click();
  page.once("dialog", dialog => dialog.accept());
  await page.getByLabel("Restore backup").setInputFiles(backupPath!);
  await expect(page.getByRole("status")).toContainText("Backup restored");
  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.getByText(/Backup Share QA/)).toBeVisible();
  await expect(page.getByText(/INV-0001/)).toBeVisible();
});
