import { expect, test, type Page } from "@playwright/test";

function identity(label:string) {
  const suffix=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  return { name:label, email:`${label.toLowerCase()}-${suffix}@example.com`, password:"InvoqlySecurePassphrase!2026" };
}

async function goTo(page:Page,section:string) { await page.locator(".nav-item").filter({hasText:section}).first().click(); }

async function createAccount(page:Page,account:ReturnType<typeof identity>) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(account.name);
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  const signupResponsePromise=page.waitForResponse(response=>response.url().includes("/api/auth/sign-up/email")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"Create account"}).click();
  const signupResponse=await signupResponsePromise;
  expect(signupResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
  await expect(page.locator("main.shell")).toBeVisible();
  await expect(page.locator(".cloud-banner")).toContainText("Secure cloud workspace");
}

test("real account, client, invoice, partial payments, expense and reload",async({page})=>{
  const account=identity("Owner");
  await createAccount(page,account);

  await goTo(page,"Invoices");
  await page.getByRole("button",{name:"New invoice"}).click();
  await page.getByLabel("Bill to").selectOption({label:"One-off customer / enter details"});
  await page.getByLabel("Customer name").fill("Acme Services");
  await page.getByLabel("Email address").fill("accounts@acme.example");
  await expect(page.getByLabel("Save this customer to contacts for next time")).not.toBeChecked();
  await page.getByLabel("Description").fill("Product design");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit price").fill("1250.50");
  await page.getByRole("button",{name:"Create invoice"}).click();

  await goTo(page,"Clients");
  await expect(page.getByText("No clients yet")).toBeVisible();
  await expect(page.getByText("Acme Services")).toHaveCount(0);
  await goTo(page,"Invoices");
  let invoiceRow=page.locator("tbody tr").filter({hasText:"Acme Services"});
  await expect(invoiceRow).toContainText("Draft");
  await expect(invoiceRow).toContainText("Acme Services");
  await invoiceRow.getByTitle("Issue invoice").click();
  await expect(invoiceRow).toContainText("Sent");

  await goTo(page,"Quotes");
  await page.getByRole("button",{name:"New quotation"}).click();
  await page.getByLabel("Customer or business name").fill("Quote Customer");
  await page.getByLabel("Email address (optional)").fill("quote@example.com");
  await page.getByLabel("Scope of work / description").fill("Website redesign");
  await page.getByLabel("Quantity").fill("1");
  await page.getByLabel("Unit price").fill("2400.00");
  await page.getByRole("button",{name:"Create quotation"}).click();
  const quoteRow=page.locator("tbody tr").filter({hasText:"Quote Customer"});
  await expect(quoteRow).toContainText("Draft");
  const quotePrintPromise=page.waitForEvent("popup");
  await quoteRow.getByTitle("Print quotation").click();
  const quotePrint=await quotePrintPromise;
  await expect(quotePrint.locator("body")).toContainText("Quote Customer");
  await quotePrint.close();
  await quoteRow.getByTitle("Mark as sent").click();
  await expect(quoteRow).toContainText("Sent");
  await quoteRow.getByTitle("Accept quotation").click();
  await expect(quoteRow).toContainText("Accepted");
  await quoteRow.getByTitle("Convert to invoice").click();
  await goTo(page,"Invoices");
  await expect(page.locator("tbody tr").filter({hasText:"Quote Customer"})).toContainText("Draft");

  await goTo(page,"Payments");
  await page.getByRole("button",{name:"Record payment"}).click();
  await page.getByLabel("Invoice").selectOption({index:0});
  await page.getByLabel("Amount received").fill("1000.00");
  await page.getByLabel("Date received").fill("2026-11-10");
  await page.getByRole("button",{name:"Save payment"}).click();
  await goTo(page,"Invoices");
  invoiceRow=page.locator("tbody tr").filter({hasText:"Acme Services"});
  await expect(invoiceRow).toContainText("Partially paid");

  await goTo(page,"Payments");
  await page.getByRole("button",{name:"Record payment"}).click();
  await page.getByLabel("Invoice").selectOption({index:0});
  await page.getByLabel("Amount received").fill("1502.00");
  await page.getByLabel("Date received").fill("2026-11-10");
  await page.getByRole("button",{name:"Save payment"}).click();
  await expect(page.locator(".form-error")).toContainText("Payment cannot exceed the outstanding invoice balance");
  await page.getByLabel("Amount received").fill("1501.00");
  await page.getByRole("button",{name:"Save payment"}).click();
  await goTo(page,"Invoices");
  invoiceRow=page.locator("tbody tr").filter({hasText:"Acme Services"});
  await expect(invoiceRow).toContainText("Paid");

  await goTo(page,"Expenses");
  await page.getByRole("button",{name:"Record expense"}).click();
  await page.getByLabel("Vendor or supplier").fill("Cloud hosting");
  const receiptPng = Buffer.from("iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/S5sAAAAASUVORK5CYII=", "base64");
  await page.locator('input[type="file"][accept="image/jpeg,image/png,image/webp"]').setInputFiles({name:"receipt.png",mimeType:"image/png",buffer:receiptPng});
  await expect(page.getByAltText("Receipt photo preview")).toBeVisible();
  await page.getByLabel("Amount").fill("350.75");
  await page.getByLabel("Currency").selectOption("ZAR");
  await page.getByLabel("Category").selectOption("Software");
  await page.getByRole("button",{name:"Save expense"}).click();
  await expect(page.getByText("Cloud hosting")).toBeVisible();
  await expect(page.getByRole("link",{name:"View receipt photo for Cloud hosting"})).toBeVisible();

  await page.reload();
  await goTo(page,"Clients");
  await expect(page.getByText("No clients yet")).toBeVisible();
  await goTo(page,"Invoices");
  await expect(page.locator("tbody tr").filter({hasText:"Acme Services"})).toContainText("Paid");
  await goTo(page,"Payments");
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await goTo(page,"Expenses");
  await expect(page.getByText("Cloud hosting")).toBeVisible();
  await expect(page.getByRole("link",{name:"View receipt photo for Cloud hosting"})).toBeVisible();
  for (const width of [320,375,768,1120]) {
    await page.setViewportSize({width,height:900});
    const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    expect(dimensions.document,`workspace overflows at ${width}px`).toBeLessThanOrEqual(dimensions.viewport);
    await expect(page.locator("main.shell")).toBeVisible();
  }
});

test("workspace data is isolated between separate accounts",async({page,browser})=>{
  test.skip(process.env.CI_COMPATIBILITY_RUNTIME === "true", "Cross-account isolation is exercised in the standard CI suite; this job focuses on runtime compatibility.");
  const first=identity("First");
  await createAccount(page,first);
  await page.getByRole("button",{name:"Add a client"}).click();
  await page.getByLabel("Client or contact name").fill("Private Client One");
  await page.getByLabel("Business name").fill("Private Client One Ltd");
  await page.getByLabel("Email address").fill("private-one@example.com");
  await page.getByRole("button",{name:"Save client"}).click();
  await expect(page.getByRole("heading",{name:"Private Client One"})).toBeVisible();

  const second=identity("Second");
  const secondContext=await browser.newContext({baseURL:process.env.PLAYWRIGHT_BASE_URL||"http://127.0.0.1:3000"});
  try {
    const secondPage=await secondContext.newPage();
    await createAccount(secondPage,second);
    await goTo(secondPage,"Clients");
    await expect(secondPage.getByText("No clients yet")).toBeVisible();
    await expect(secondPage.getByText("Private Client One")).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
});

for(const width of [320,375,768,1120]){
  test(`account screens have no horizontal overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
    await page.goto("/");
    await expect(page.getByRole("heading",{name:/Spend less time/})).toBeVisible();
    const publicDimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    expect(publicDimensions.document).toBeLessThanOrEqual(publicDimensions.viewport);
    await page.goto("/sign-in");
    await expect(page.locator(".auth-shell")).toBeVisible();
    const dimensions=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    expect(dimensions.document).toBeLessThanOrEqual(dimensions.viewport);
    await page.goto("/sign-up");
    const signup=await page.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
    expect(signup.document).toBeLessThanOrEqual(signup.viewport);
    await page.goto("/forgot-password");
    await expect(page.getByRole("heading",{name:"Reset your password"})).toBeVisible();
    await page.goto("/reset-password");
    await expect(page.getByRole("heading",{name:"Choose a new password"})).toBeVisible();
  });
}
