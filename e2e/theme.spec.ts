import { expect, test } from "@playwright/test";

function contrastRatio(foreground: string, background: string) {
  const channels = (value: string) => {
    const parts = value.match(/[\d.]+/g)?.slice(0, 3).map(Number);
    if (!parts || parts.length !== 3) throw new Error("Unexpected computed colour: " + value);
    return parts.map(channel => {
      const normalized = channel / 255;
      return normalized <= 0.04045 ? normalized / 12.92 : ((normalized + 0.055) / 1.055) ** 2.4;
    });
  };
  const luminance = (value: string) => {
    const [r, g, b] = channels(value);
    return 0.2126 * r! + 0.7152 * g! + 0.0722 * b!;
  };
  const a = luminance(foreground);
  const b = luminance(background);
  return (Math.max(a, b) + 0.05) / (Math.min(a, b) + 0.05);
}

test("light and dark themes toggle, persist and remain legible at phone and desktop widths", async ({ page }) => {
  await page.goto("/guest");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
  await page.getByRole("button", { name: "Switch to dark mode" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  expect(await page.evaluate(() => localStorage.getItem("invoqly.theme"))).toBe("dark");
  await expect(page.getByRole("heading", { name: "Your business, in good order." })).toBeVisible();

  for (const width of [320, 390, 768, 1440]) {
    await page.setViewportSize({ width, height: 900 });
    const measurements = await page.evaluate(() => {
      const main = document.querySelector("main");
      const heading = document.querySelector("h1");
      const supporting = document.querySelector("section p");
      const panelHeading = document.querySelector("h2");
      const panel = panelHeading?.parentElement?.parentElement?.parentElement;
      const panelSupporting = panelHeading?.nextElementSibling;
      return {
        viewport: document.documentElement.clientWidth,
        page: document.documentElement.scrollWidth,
        shellBackground: main ? getComputedStyle(main).backgroundColor : "",
        heading: heading ? getComputedStyle(heading).color : "",
        supporting: supporting ? getComputedStyle(supporting).color : "",
        panelBackground: panel ? getComputedStyle(panel).backgroundColor : "",
        panelHeading: panelHeading ? getComputedStyle(panelHeading).color : "",
        panelSupporting: panelSupporting ? getComputedStyle(panelSupporting).color : ""
      };
    });
    expect(measurements.page, `horizontal overflow at ${width}px`).toBeLessThanOrEqual(measurements.viewport);
    expect(measurements.shellBackground).toBe("rgb(17, 24, 19)");
    expect(contrastRatio(measurements.heading, measurements.shellBackground)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(measurements.supporting, measurements.shellBackground)).toBeGreaterThanOrEqual(4.5);
    expect(measurements.panelBackground).toBe("rgb(24, 34, 27)");
    expect(contrastRatio(measurements.panelHeading, measurements.panelBackground)).toBeGreaterThanOrEqual(7);
    expect(contrastRatio(measurements.panelSupporting, measurements.panelBackground)).toBeGreaterThanOrEqual(4.5);
    if (width === 390) await page.screenshot({ path: "test-results/invoqly-guest-dark-mobile.png", fullPage: true });
    if (width === 1440) await page.screenshot({ path: "test-results/invoqly-guest-dark-desktop.png", fullPage: true });
  }

  await page.reload();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("dark");
  await page.getByRole("button", { name: "Switch to light mode" }).click();
  await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe("light");
  await expect(page.getByRole("button", { name: "Switch to dark mode" })).toBeVisible();
});


test("signed-in workspace keeps every section usable in both themes and on mobile", async ({ page }) => {
  test.setTimeout(120_000);
  await page.setViewportSize({ width: 1440, height: 1000 });
  await page.goto("/sign-up");
  await expect(page.getByRole("button", { name: "Create account" })).toBeEnabled();
  await page.getByLabel("Your name").fill("Theme QA");
  await page.getByLabel("Email address").fill("theme-qa-" + Date.now() + "@example.com");
  await page.locator('input[type="password"]').fill("InvoqlyThemeQA-2026!");
  const signupPromise = page.waitForResponse(response => response.url().includes("/api/auth/sign-up/email") && response.request().method() === "POST");
  await page.getByRole("button", { name: "Create account" }).click();
  expect((await signupPromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator("main.shell")).toBeVisible();

  const sections = ["Overview", "AI Co-pilot", "Invoices", "Quotes", "Clients", "Expenses", "Payments", "Reports", "Cash flow", "Settings"];
  for (const theme of ["dark", "light"] as const) {
    const toggleName = theme === "dark" ? "Switch to dark mode" : "Switch to light mode";
    if (await page.getByRole("button", { name: toggleName }).isVisible()) await page.getByRole("button", { name: toggleName }).click();
    await expect.poll(() => page.evaluate(() => document.documentElement.dataset.theme)).toBe(theme);
    for (const section of sections) {
      await page.locator(".sidebar .nav-item").filter({ hasText: section }).first().click();
      await expect(page.locator(".breadcrumb b")).toHaveText(section);
      await expect(page.locator(".page-content > :not(.page-footer)").first()).toBeVisible();
      if (section === "Cash flow") {
        await expect(page.getByRole("heading", { name: "Cash flow." })).toBeVisible();
        await expect(page.getByRole("heading", { name: "13-week cash movement" })).toBeVisible();
        await expect(page.getByText("Cash position settings")).toBeVisible();
        if (theme === "dark") {
          const amounts = page.locator(".cashflow-money-input input");
          await amounts.nth(0).fill("12500.00");
          await amounts.nth(1).fill("2500.00");
          const saveResponse = page.waitForResponse(response => response.url().includes("/api/workspace") && response.request().method() === "POST");
          await page.getByRole("button", { name: "Save cash settings" }).click();
          expect((await saveResponse).status()).toBe(200);
          await expect(amounts.nth(0)).toHaveValue("12500.00");
          await page.getByLabel("Delay receipts").check();
          await expect(page.getByText("Safe to spend after delay")).toBeVisible();
          await page.screenshot({ path: "test-results/invoqly-cashflow-dark-desktop.png", fullPage: true });
        } else {
          await page.screenshot({ path: "test-results/invoqly-cashflow-light-desktop.png", fullPage: true });
        }
      }
      expect((await page.locator(".page-content").innerText()).trim().length, section + " should render useful content").toBeGreaterThan(20);
      const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
      expect(dimensions.scrollWidth, section + " horizontal overflow in " + theme).toBeLessThanOrEqual(dimensions.width);
    }
  }

  await page.setViewportSize({ width: 390, height: 844 });
  for (const theme of ["light", "dark"] as const) {
    const current = await page.evaluate(() => document.documentElement.dataset.theme);
    if (current !== theme) await page.getByRole("button", { name: theme === "dark" ? "Switch to dark mode" : "Switch to light mode" }).click();
    for (const section of ["Overview", "Invoices", "Quotes", "Clients", "Expenses"]) {
      await page.locator(".sidebar .nav-item").filter({ hasText: section }).first().click();
      await expect(page.locator(".breadcrumb b")).toHaveText(section);
    }
    for (const section of ["AI Co-pilot", "Payments", "Reports", "Cash flow", "Settings"]) {
      await page.getByRole("button", { name: "More workspace sections" }).click();
      await page.getByRole("menuitem", { name: section }).click();
      await expect(page.locator(".breadcrumb b")).toHaveText(section);
    }
    const dimensions = await page.evaluate(() => ({ width: document.documentElement.clientWidth, scrollWidth: document.documentElement.scrollWidth }));
    expect(dimensions.scrollWidth, "mobile horizontal overflow in " + theme).toBeLessThanOrEqual(dimensions.width);
  }
});
