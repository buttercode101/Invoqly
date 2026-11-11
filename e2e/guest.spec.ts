import { expect, test } from "@playwright/test";

test("visitors can create and keep a local workspace without registering",async({page})=>{
  await page.goto("/guest");
  await expect(page.getByRole("heading",{name:"Your business, in good order."})).toBeVisible();
  await expect(page.getByText("You're using Invoqly for free, without signing up.")).toBeVisible();

  await page.getByRole("button",{name:"＋ Add a client"}).click();
  await page.getByLabel("Client name").fill("Guest Client");
  await page.getByLabel("Email address").fill("guest@example.com");
  await page.getByRole("button",{name:"Save client"}).click();
  await page.getByRole("button",{name:"Invoices"}).click();
  await page.getByRole("button",{name:"New invoice"}).click();
  await page.getByLabel("Bill to").selectOption({label:"Guest Client"});
  await page.getByLabel("Description").fill("Consulting");
  await page.getByLabel("Unit price (ZAR)").fill("1250.00");
  await page.getByRole("button",{name:"Create invoice"}).click();
  await expect(page.getByText(/INV-0001 · Guest Client/)).toBeVisible();
  await page.getByRole("button",{name:"Issue"}).click();
  await page.getByRole("button",{name:"Mark paid"}).click();

  await page.getByRole("button",{name:"Expenses"}).click();
  await page.getByRole("button",{name:"Add expense"}).click();
  await page.getByLabel("Vendor or supplier").fill("Guest hosting");
  await page.getByLabel("Amount (ZAR)").fill("99.50");
  await page.getByRole("button",{name:"Save expense"}).click();
  await expect(page.getByText("Guest hosting")).toBeVisible();

  await page.reload();
  await page.getByRole("button",{name:"Invoices"}).click();
  await expect(page.getByText(/INV-0001 · Guest Client/)).toBeVisible();
  await expect(page.getByText("Paid")).toBeVisible();
  await page.getByRole("button",{name:"Expenses"}).click();
  await expect(page.getByText("Guest hosting")).toBeVisible();
  await expect(page.getByRole("link",{name:"Create free account"})).toBeVisible();
});
