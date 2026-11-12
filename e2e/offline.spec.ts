import { expect, test } from "@playwright/test";

test("guest workspace shell and app assets reopen offline after first online visit", async ({ page, context }) => {
  await page.goto("/guest");
  await expect(page.getByRole("heading", { name: "Your business, in good order." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create invoice" })).toBeVisible();

  const registration = await page.evaluate(async () => {
    if (!("serviceWorker" in navigator)) return { supported: false, controlled: false, manifest: false };
    await navigator.serviceWorker.ready;
    return {
      supported: true,
      controlled: Boolean(navigator.serviceWorker.controller),
      manifest: Boolean(document.querySelector('link[rel="manifest"]'))
    };
  });
  expect(registration.supported).toBe(true);
  expect(registration.manifest).toBe(true);

  await page.reload();
  await expect.poll(() => page.evaluate(() => Boolean(navigator.serviceWorker.controller))).toBe(true);
  await expect(page.getByRole("button", { name: "Create invoice" })).toBeVisible();

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole("heading", { name: "Your business, in good order." })).toBeVisible();
  await expect(page.getByRole("button", { name: "Create invoice" })).toBeVisible();
  await expect(page.getByRole("button", { name: "Invoices" })).toBeVisible();
  await context.setOffline(false);
});
