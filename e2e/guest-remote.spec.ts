import { expect, test } from "@playwright/test";

test("remote preview supports real guest invoicing without creating an account or writing to cloud storage",async({page})=>{
  await page.goto("/");
  await page.getByRole("link",{name:"Try Invoqly free — no account"}).click();
  await expect(page).toHaveURL(/\/guest$/);
  await expect(page.getByRole("heading",{name:"Your business, in good order."})).toBeVisible();

  await page.getByRole("button",{name:"Settings"}).click();
  await page.getByLabel("Business or trading name").fill("Preview Guest Studio");
  for(const width of [320,375,768,1120]){
    await page.setViewportSize({width,height:900});
    const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
  }
  await page.setViewportSize({width:1280,height:900});
  await page.getByRole("button",{name:"Overview"}).click();
  await page.getByRole("button",{name:"＋ Add a client"}).click();
  await page.getByLabel("Client name").fill("Preview Guest Client");
  await page.getByLabel("Email address").fill("preview-guest@example.com");
  await page.getByRole("button",{name:"Save client"}).click();
  await page.getByRole("button",{name:"Invoices"}).click();
  await page.getByRole("button",{name:"New invoice"}).click();
  await page.getByLabel("Bill to").selectOption({label:"Preview Guest Client"});
  await page.getByLabel("Description").fill("Preview guest service");
  await page.getByLabel("Unit price (ZAR)").fill("750.00");
  await page.getByRole("button",{name:"Create invoice"}).click();

  const popupPromise=page.waitForEvent("popup");
  await page.getByRole("button",{name:"Print / PDF"}).click();
  const popup=await popupPromise;
  await expect(popup.locator("h1").first()).toHaveText("Preview Guest Studio");
  await popup.close();

  await page.getByRole("button",{name:"Issue"}).click();
  await page.getByRole("button",{name:"Mark paid"}).click();
  await page.getByRole("button",{name:"Expenses"}).click();
  await page.getByRole("button",{name:"Add expense"}).click();
  await page.getByLabel("Vendor or supplier").fill("Preview Guest Hosting");
  await page.getByLabel("Amount (ZAR)").fill("25.00");
  await page.getByRole("button",{name:"Save expense"}).click();
  await page.reload();
  await page.locator("nav").getByRole("button",{name:"Clients"}).click();
  await expect(page.getByText("Preview Guest Client")).toBeVisible();
  await page.locator("nav").getByRole("button",{name:"Invoices"}).click();
  await expect(page.getByText(/INV-0001 · Preview Guest Client/)).toBeVisible();
  await page.locator("nav").getByRole("button",{name:"Expenses"}).click();
  await expect(page.getByText("Preview Guest Hosting")).toBeVisible();
  await expect(page.getByRole("link",{name:"Sign in"})).toBeVisible();
  const guestData=await page.evaluate(()=>localStorage.getItem("invoqly.guest.workspace.v1"));
  expect(guestData).not.toBeNull();
});
