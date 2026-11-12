import { expect, test } from "@playwright/test";

function contrastRatio(foreground: string, background: string) {
  const channels = (value: string) => {
    const parts = value.match(/[\\d.]+/g)?.slice(0, 3).map(Number);
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
      const panel = panelHeading?.parentElement?.parentElement;
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
