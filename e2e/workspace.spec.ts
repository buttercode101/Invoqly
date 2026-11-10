import { expect, test, type Page } from "@playwright/test";

function identity(label:string) {
  const suffix=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  return { name:label, email:`${label.toLowerCase()}-${suffix}@example.com`, password:"InvoqlySecurePassphrase!2026" };
}

async function createAccount(page:Page,account:ReturnType<typeof identity>) {
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(account.name);
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  const signupResponsePromise=page.waitForResponse(response=>response.url().includes("/api/auth/sign-up/email")&&response.request().method()==="POST");
  await page.getByRole("button",{name:"Create account"}).click();
  const signupResponse=await signupResponsePromise;
  expect(signupResponse.status()).toBe(200);
  await expect(page).toHaveURL(/\/sign-in\?created=1$/);
  await expect(page.locator(".auth-success")).toContainText("Account created");
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  await page.getByRole("button",{name:"Sign in"}).click();
  await expect(page.locator("main.shell")).toBeVisible();
  await expect(page.locator(".cloud-banner")).toContainText("Secure cloud workspace");
}

test("real account, client, invoice, partial payments, expense and reload",async({page})=>{
  const account=identity("Owner");
  await createAccount(page,account);

  await page.getByRole("button",{name:"Add a client"}).click();
  await page.getByLabel("Client or contact name").fill("Acme Services");
  await page.getByLabel("Business name").fill("Acme Services Ltd");
  await page.getByLabel("Email address").fill("accounts@acme.example");
  await page.getByRole("button",{name:"Save client"}).click();
  await expect(page.getByRole("heading",{name:"Acme Services"})).toBeVisible();

  await page.getByRole("button",{name:"Invoices"}).click();
  await page.getByRole("button",{name:"New invoice"}).click();
  await page.getByLabel("Bill to").selectOption({label:"Acme Services"});
  await page.getByLabel("Description").fill("Product design");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit price").fill("1250.50");
  await page.getByRole("button",{name:"Create invoice"}).click();

  let invoiceRow=page.locator("tbody tr").filter({hasText:"Acme Services"});
  await expect(invoiceRow).toContainText("Draft");
  await invoiceRow.getByTitle("Issue invoice").click();
  await expect(invoiceRow).toContainText("Sent");

  await page.getByRole("button",{name:"Payments"}).click();
  await page.getByRole("button",{name:"Record payment"}).click();
  await page.getByLabel("Invoice").selectOption({index:0});
  await page.getByLabel("Amount received").fill("1000.00");
  await page.getByLabel("Date received").fill("2026-11-10");
  await page.getByRole("button",{name:"Save payment"}).click();
  await page.getByRole("button",{name:"Invoices"}).click();
  invoiceRow=page.locator("tbody tr").filter({hasText:"Acme Services"});
  await expect(invoiceRow).toContainText("Partially paid");

  await page.getByRole("button",{name:"Payments"}).click();
  await page.getByRole("button",{name:"Record payment"}).click();
  await page.getByLabel("Invoice").selectOption({index:0});
  await page.getByLabel("Amount received").fill("1502.00");
  await page.getByLabel("Date received").fill("2026-11-10");
  await page.getByRole("button",{name:"Save payment"}).click();
  await expect(page.locator(".form-error")).toContainText("Payment cannot exceed the outstanding invoice balance");
  await page.getByLabel("Amount received").fill("1501.00");
  await page.getByRole("button",{name:"Save payment"}).click();
  await page.getByRole("button",{name:"Invoices"}).click();
  invoiceRow=page.locator("tbody tr").filter({hasText:"Acme Services"});
  await expect(invoiceRow).toContainText("Paid");

  await page.getByRole("button",{name:"Expenses"}).click();
  await page.getByRole("button",{name:"Record expense"}).click();
  await page.getByLabel("Vendor or supplier").fill("Cloud hosting");
  await page.getByLabel("Amount").fill("350.75");
  await page.getByLabel("Currency").selectOption("ZAR");
  await page.getByLabel("Category").selectOption("Software");
  await page.getByRole("button",{name:"Save expense"}).click();
  await expect(page.getByText("Cloud hosting")).toBeVisible();

  await page.reload();
  await page.getByRole("button",{name:"Clients"}).click();
  await expect(page.getByRole("heading",{name:"Acme Services"})).toBeVisible();
  await page.getByRole("button",{name:"Invoices"}).click();
  await expect(page.locator("tbody tr").filter({hasText:"Acme Services"})).toContainText("Paid");
  await page.getByRole("button",{name:"Payments"}).click();
  await expect(page.locator("tbody tr")).toHaveCount(2);
  await page.getByRole("button",{name:"Expenses"}).click();
  await expect(page.getByText("Cloud hosting")).toBeVisible();
});

test("workspace data is isolated between separate accounts",async({page,browser})=>{
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
    await secondPage.getByRole("button",{name:"Clients"}).click();
    await expect(secondPage.getByText("No clients yet")).toBeVisible();
    await expect(secondPage.getByText("Private Client One")).toHaveCount(0);
  } finally {
    await secondContext.close();
  }
});

for(const width of [320,375,768,1120]){
  test(`account screens have no horizontal overflow at ${width}px`,async({page})=>{
    await page.setViewportSize({width,height:900});
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
