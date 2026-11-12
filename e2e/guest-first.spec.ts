import { expect, test } from "@playwright/test";

test("anonymous visitor can invoice without contacts and complete a quotation", async ({ page }) => {
  await page.goto("/");
  await page.getByRole("link", { name: "Try Invoqly free — no account" }).click();
  await expect(page).toHaveURL(/guest$/);

  await page.getByRole("button", { name: "Invoices" }).click();
  await page.getByRole("button", { name: "New invoice" }).click();
  await page.getByLabel("Customer name").fill("Anonymous QA Customer");
  await page.getByLabel("Email address").fill("anonymous@example.com");
  await page.getByLabel("Description").fill("One-off service");
  await page.getByLabel("Unit price (ZAR)").fill("999.00");
  await expect(page.getByLabel("Save this customer to my contacts for next time")).not.toBeChecked();
  await page.getByRole("button", { name: "Create invoice" }).click();
  await expect(page.getByText(/Anonymous QA Customer/)).toBeVisible();

  await page.getByRole("button", { name: "Clients" }).click();
  await expect(page.getByText("No clients yet")).toBeVisible();

  await page.getByRole("button", { name: "Quotes" }).click();
  await page.getByRole("button", { name: "New quote" }).click();
  await expect(page.getByRole("heading", { name: "Create a quotation" })).toBeVisible();
  await page.getByLabel("Customer name").fill("Quote QA Customer");
  await page.getByLabel("Email address").fill("quote@example.com");
  await page.getByLabel("Description").fill("Consulting scope");
  await page.getByLabel("Unit price (ZAR)").fill("450.00");
  await page.getByRole("button", { name: "Create quotation" }).click();
  await page.getByRole("button", { name: "Mark as sent" }).click();
  await page.getByRole("button", { name: "Accept" }).click();
  await page.getByRole("button", { name: "Convert to invoice" }).click();

  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.getByText(/Quote QA Customer/)).toBeVisible();
  await page.reload();
  await expect(page.getByText("You're using Invoqly for free, without signing up.")).toBeVisible();
  await page.getByRole("button", { name: "Clients" }).click();
  await expect(page.getByText("No clients yet")).toBeVisible();
  await page.getByRole("button", { name: "Invoices" }).click();
  await expect(page.getByText(/Anonymous QA Customer/)).toBeVisible();
  await expect(page.getByText(/Quote QA Customer/)).toBeVisible();

  for (const width of [320,360,375,390,560,768,820,1120,1440]) {
    await page.setViewportSize({ width, height: 900 });
    const dimensions = await page.evaluate(() => ({
      viewport: document.documentElement.clientWidth,
      document: document.documentElement.scrollWidth
    }));
    expect(dimensions.document, "guest workspace overflows at "+width+"px").toBeLessThanOrEqual(dimensions.viewport);
    if(width<=560){
      const targets=await page.locator("nav button:visible").evaluateAll(nodes=>nodes.map(node=>{const r=node.getBoundingClientRect();return {width:r.width,height:r.height}}));
      expect(targets.length).toBeGreaterThanOrEqual(5);
      for(const target of targets){expect(target.width).toBeGreaterThanOrEqual(40);expect(target.height).toBeGreaterThanOrEqual(44);}
    }
    if(width===390||width===1440){
      await page.getByRole("button",{name:"Overview"}).click();
      await page.screenshot({path:width===390?"test-results/invoqly-guest-mobile-390.png":"test-results/invoqly-guest-desktop-1440.png",fullPage:true});
    }
  }
});
