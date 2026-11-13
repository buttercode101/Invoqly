import { expect, test, type Page } from "@playwright/test";
import { readFile } from "node:fs/promises";

function identity(label:string) {
  const suffix=`${Date.now()}-${Math.random().toString(36).slice(2,8)}`;
  const slug=label.toLowerCase().replace(/[^a-z0-9]+/g,"-").replace(/^-|-$/g,"")||"workspace";
  return {name:label,email:`${slug}-${suffix}@example.com`,password:"InvoqlySecurePassphrase!2026"};
}
async function goTo(page:Page,section:string) {
  await page.locator(".sidebar .nav-item").filter({hasText:section}).first().click();
}
async function createAccount(page:Page,label:string) {
  const account=identity(label);
  await page.goto("/sign-up");
  await page.getByLabel("Your name").fill(account.name);
  await page.getByLabel("Email address").fill(account.email);
  await page.locator('input[type="password"]').fill(account.password);
  const responsePromise=page.waitForResponse(r=>r.url().includes("/api/auth/sign-up/email")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Create account"}).click();
  expect((await responsePromise).status()).toBe(200);
  await expect(page).toHaveURL(/\/app$/);
}
async function createQuote(page:Page,customerName:string) {
  await goTo(page,"Quotes");
  await page.getByRole("button",{name:"New quotation"}).click();
  await page.getByLabel("Customer or business name").fill(customerName);
  await page.getByLabel("Email address (optional)").fill(customerName.toLowerCase().replace(/\s+/g,".")+"@example.com");
  await page.getByLabel("Scope of work / description").fill("Website design and implementation");
  await page.getByLabel("Quantity").fill("2");
  await page.getByLabel("Unit price").fill("1800.00");
  await page.getByRole("button",{name:"Create quotation"}).click();
  const response=await page.request.get("/api/workspace");
  expect(response.status()).toBe(200);
  const payload=await response.json() as {workspace:{quotes:Array<{id:string;number:string;customerName:string;status:string}>}};
  const quote=payload.workspace.quotes.find(item=>item.customerName===customerName);
  if(!quote)throw new Error("The newly created quotation was not returned by the workspace API.");
  const row=page.locator(".quote-table-desktop tbody tr").filter({hasText:customerName});
  await expect(row).toContainText("Draft");
  return quote;
}
async function shareApprovalLink(page:Page,quoteId:string) {
  const responsePromise=page.waitForResponse(r=>r.url().includes("/api/quotes/"+quoteId+"/share")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Create client approval link"}).click();
  const response=await responsePromise;
  expect(response.status()).toBe(200);
  const body=await response.json() as {url:string;expiresAt:string};
  expect(body.url).toMatch(/^https?:\/\//);
  await page.waitForFunction(()=>Boolean((window as Window & {__sharedQuoteLink?:string}).__sharedQuoteLink));
  const shared=await page.evaluate(()=> (window as Window & {__sharedQuoteLink?:string}).__sharedQuoteLink);
  expect(shared).toBe(body.url);
  return body.url;
}
async function workspaceQuote(page:Page,customerName:string) {
  const response=await page.request.get("/api/workspace");
  expect(response.status()).toBe(200);
  const payload=await response.json() as {workspace:{quotes:Array<Record<string,any>>}};
  const quote=payload.workspace.quotes.find(item=>item.customerName===customerName);
  if(!quote)throw new Error("Quotation missing from the signed-in workspace.");
  return quote;
}

test("client accepts and e-signs a branded quotation without an account; status and signed PDF stay in sync",async({page,browser})=>{
  test.setTimeout(240_000);
  await page.addInitScript(()=>{
    const nav=navigator as Navigator & {canShare?:(data:ShareData)=>boolean;share?:(data:ShareData)=>Promise<void>};
    Object.defineProperty(nav,"canShare",{configurable:true,value:(data:ShareData)=>Array.isArray(data.files)&&data.files.every(file=>file.type==="application/pdf")});
    Object.defineProperty(nav,"share",{configurable:true,value:async(data:ShareData)=>{
      if(data.url)(window as Window & {__sharedQuoteLink?:string}).__sharedQuoteLink=data.url;
      if(data.files)(window as Window & {__sharedPdfFiles?:Array<{name:string;type:string;size:number}>}).__sharedPdfFiles=data.files.map(file=>({name:file.name,type:file.type,size:file.size}));
    }});
  });
  await createAccount(page,"Approval Owner");
  await goTo(page,"Settings");
  await expect(page.locator(".document-template-choice")).toHaveCount(6);
  await page.getByLabel("Brand name").fill("Northstar Studio");
  await page.getByLabel("Brand colour").fill("#3a6b52");
  const logoPng="iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mP8/x8AAwMCAO+/cS8AAAAASUVORK5CYII=";
  await page.locator('.document-brand-fields input[type="file"]').setInputFiles({name:"northstar-logo.png",mimeType:"image/png",buffer:Buffer.from(logoPng,"base64")});
  await expect(page.locator(".document-logo-preview img")).toBeVisible();
  await page.locator(".document-template-choice").filter({hasText:"Editorial"}).click();
  const settingsResponse=page.waitForResponse(r=>r.url().endsWith("/api/workspace")&&r.request().method()==="POST");
  await page.getByRole("button",{name:"Save document branding"}).click();
  expect((await settingsResponse).status()).toBe(200);

  const quote=await createQuote(page,"Approval Client");
  const row=page.locator(".quote-table-desktop tbody tr").filter({hasText:"Approval Client"});
  const link=await shareApprovalLink(row,quote.id).catch(async()=>shareApprovalLink(page,quote.id));
  await expect(row).toContainText("Sent");

  const clientContext=await browser.newContext();
  try {
    const clientPage=await clientContext.newPage();
    await clientPage.setViewportSize({width:390,height:844});
    await clientPage.goto(link);
    await expect(clientPage.getByRole("heading",{name:"Review and respond"})).toBeVisible();
    await expect(clientPage.getByText("Northstar Studio")).toBeVisible();
    await expect(clientPage.locator(".public-quote-logo")).toBeVisible();
    await expect(clientPage.getByRole("button",{name:"Download PDF"})).toBeVisible();
    for(const width of [320,375,768,1440]){
      await clientPage.setViewportSize({width,height:900});
      const dimensions=await clientPage.evaluate(()=>({viewport:document.documentElement.clientWidth,document:document.documentElement.scrollWidth}));
      expect(dimensions.document,"public quotation overflow at "+width+"px").toBeLessThanOrEqual(dimensions.viewport);
    }
    const viewed=await workspaceQuote(page,"Approval Client");
    expect(viewed.status).toBe("Viewed");
    expect(viewed.lastViewedAt).toBeTruthy();

    await clientPage.getByLabel("Full name").fill("Jane Client");
    await clientPage.locator('.public-quote-field input[type="email"]').fill("jane.client@example.com");
    await clientPage.locator(".public-quote-consent input").check();
    const canvas=clientPage.locator('canvas[aria-label="Draw your electronic signature"]');
    const bounds=await canvas.boundingBox();
    expect(bounds).not.toBeNull();
    await clientPage.mouse.move(bounds!.x+35,bounds!.y+82);
    await clientPage.mouse.down();
    await clientPage.mouse.move(bounds!.x+95,bounds!.y+52,{steps:7});
    await clientPage.mouse.move(bounds!.x+150,bounds!.y+91,{steps:7});
    await clientPage.mouse.move(bounds!.x+215,bounds!.y+62,{steps:7});
    await clientPage.mouse.up();
    await clientPage.getByRole("button",{name:"Accept & sign quotation"}).click();
    await expect(clientPage.getByRole("heading",{name:"Quotation accepted"})).toBeVisible();
    const accepted=await workspaceQuote(page,"Approval Client");
    expect(accepted.status).toBe("Accepted");
    expect(accepted.signerName).toBe("Jane Client");
    expect(accepted.signerEmail).toBe("jane.client@example.com");
    expect(accepted.signatureDataUrl).toMatch(/^data:image\/jpeg;base64,/);
    expect(accepted.agreementAt).toBeTruthy();
    expect(accepted.decisionAt).toBeTruthy();

    await page.reload();
    await goTo(page,"Quotes");
    const refreshedRow=page.locator(".quote-table-desktop tbody tr").filter({hasText:"Approval Client"});
    await expect(refreshedRow).toContainText("Accepted");
    await refreshedRow.getByTitle("Convert to invoice").click();
    await expect(refreshedRow).toContainText("Converted");
    await clientPage.reload();
    await expect(clientPage.getByRole("heading",{name:"Quotation accepted"})).toBeVisible();

    const pdfDownloadPromise=clientPage.waitForEvent("download");
    await clientPage.getByRole("button",{name:"Download PDF"}).click();
    const download=await pdfDownloadPromise;
    const pdfPath=await download.path();
    expect(pdfPath).toBeTruthy();
    const pdf=await readFile(pdfPath!);
    const source=pdf.toString("latin1");
    expect(source.startsWith("%PDF-1.4")).toBe(true);
    expect(source).toContain("Northstar Studio");
    expect(source).toContain("Signed by Jane Client");
    expect(source).toContain("Scope and terms accepted");
    expect(source).toContain("/Subtype /Image");

    const token=new URL(link).pathname.split("/").pop()!;
    const duplicate=await clientPage.request.post(new URL("/api/public/quotes/"+token,link).toString(),{
      headers:{origin:new URL(link).origin},
      data:{decision:"Accepted",signerName:"Jane Client",signerEmail:"jane.client@example.com",agreed:true,signatureDataUrl:accepted.signatureDataUrl}
    });
    expect(duplicate.status()).toBe(409);

    await refreshedRow.getByTitle("Share actual quotation PDF file").click();
    const sharedFiles=await page.evaluate(()=> (window as Window & {__sharedPdfFiles?:Array<{name:string;type:string;size:number}>}).__sharedPdfFiles??[]);
    expect(sharedFiles).toHaveLength(1);
    expect(sharedFiles[0]).toMatchObject({name:quote.number+".pdf",type:"application/pdf"});
    expect(sharedFiles[0]!.size).toBeGreaterThan(500);
  } finally {
    await clientContext.close();
  }
});

test("client decline is recorded and owner revocation invalidates an open link",async({page,browser})=>{
  test.setTimeout(240_000);
  await page.addInitScript(()=>{
    const nav=navigator as Navigator & {share?:(data:ShareData)=>Promise<void>};
    Object.defineProperty(nav,"share",{configurable:true,value:async(data:ShareData)=>{if(data.url)(window as Window & {__sharedQuoteLink?:string}).__sharedQuoteLink=data.url}});
  });
  await createAccount(page,"Decision Owner");
  const declineQuote=await createQuote(page,"Decline Client");
  const declineRow=page.locator(".quote-table-desktop tbody tr").filter({hasText:"Decline Client"});
  const declineLink=await shareApprovalLink(declineRow,declineQuote.id);

  const clientContext=await browser.newContext();
  try {
    const clientPage=await clientContext.newPage();
    await clientPage.goto(declineLink);
    await expect(clientPage.getByRole("heading",{name:"Review and respond"})).toBeVisible();
    await clientPage.getByLabel("Full name").fill("Alex Client");
    await clientPage.locator(".public-quote-decline summary").click();
    await clientPage.locator(".public-quote-decline textarea").fill("The proposed delivery date does not work for us.");
    await clientPage.getByRole("button",{name:"Confirm decline"}).click();
    await expect(clientPage.getByRole("heading",{name:"Quotation declined"})).toBeVisible();
    const declined=await workspaceQuote(page,"Decline Client");
    expect(declined.status).toBe("Declined");
    expect(declined.signerName).toBe("Alex Client");
    expect(declined.rejectionReason).toContain("delivery date");

    const revokeQuote=await createQuote(page,"Revoke Client");
    const revokeRow=page.locator(".quote-table-desktop tbody tr").filter({hasText:"Revoke Client"});
    const revokeLink=await shareApprovalLink(revokeRow,revokeQuote.id);
    await clientPage.goto(revokeLink);
    await expect(clientPage.getByRole("heading",{name:"Review and respond"})).toBeVisible();
    const viewed=await workspaceQuote(page,"Revoke Client");
    expect(viewed.status).toBe("Viewed");

    await page.reload();
    await goTo(page,"Quotes");
    const refreshed=page.locator(".quote-table-desktop tbody tr").filter({hasText:"Revoke Client"});
    page.once("dialog",dialog=>dialog.accept());
    await refreshed.getByTitle("Revoke client approval link").click();
    const revoked=await workspaceQuote(page,"Revoke Client");
    expect(revoked.status).toBe("Draft");
    expect(revoked.shareLinkRevoked).toBe(true);
    await clientPage.reload();
    await expect(clientPage.getByRole("heading",{name:"Quotation unavailable"})).toBeVisible();
  } finally {
    await clientContext.close();
  }
});
