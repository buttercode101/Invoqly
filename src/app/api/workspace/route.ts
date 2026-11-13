import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { headReceiptObject } from "@/lib/receipts";
import { z } from "zod";
import { withDb } from "@/lib/db";
import { auditEvents, clients, expenses, invoiceCounters, invoices, payments, quoteCounters, quotePublicLinks, quotes, workspaces } from "@/lib/db/schema";
import { getCurrentUser, getOrCreateWorkspace, loadWorkspace } from "@/lib/workspace";
import { deriveInvoiceStatus, outstandingBalanceMinor } from "@/lib/billing";
import { applyDocumentTaxProfile, calculateDocumentTotal, resolveDocumentLineItems, type DocumentLineItem } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currency = z.string().regex(/^[A-Z]{3}$/).refine(value=>{try{new Intl.NumberFormat("en",{style:"currency",currency:value}).format(0);return true}catch{return false}},"Choose a supported ISO currency code.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const [year,month,day]=value.split("-").map(Number);const parsed=new Date(Date.UTC(year,month-1,day));return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day},"Enter a real calendar date.");
const lineItem = z.object({description:z.string().trim().min(1).max(500),quantity:z.number().int().min(1).max(1000000),unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),taxTreatment:z.enum(["standard","zero_rated","exempt","out_of_scope"]).optional(),priceMode:z.enum(["inclusive","exclusive"]).optional()});
const documentSettings = z.object({templateId:z.enum(["modern","minimal","classic","bold","editorial","custom"]),accentColor:z.string().regex(/^#[0-9a-fA-F]{6}$/),logoDataUrl:z.string().max(250000).regex(/^data:image\/jpeg;base64,[A-Za-z0-9+/]+={0,2}$/).nullable(),brandName:z.string().max(120)});
const payload = z.discriminatedUnion("action", [
  z.object({ action:z.literal("update-document-settings"), documentSettings }),
  z.object({ action:z.literal("update-settings"), businessName:z.string().trim().min(1).max(120), currency, locale:z.string().min(2).max(20), vatRegistered:z.boolean().optional(), vatNumber:z.string().trim().max(10).optional(), businessAddress:z.string().trim().max(250).optional(), openingCashBalanceMinor:z.number().int().min(-Number.MAX_SAFE_INTEGER).max(Number.MAX_SAFE_INTEGER).nullable().optional(), cashReserveMinor:z.number().int().nonnegative().max(Number.MAX_SAFE_INTEGER).optional() }),
  z.object({ action:z.literal("create-client"), name:z.string().trim().min(1).max(120), email:z.union([z.string().trim().email().max(254).toLowerCase(),z.literal("")]).default(""), company:z.string().max(120).default(""), currency }),
  z.object({ action:z.literal("update-client"), clientId:z.string().uuid(), name:z.string().trim().min(1).max(120), email:z.union([z.string().trim().email().max(254).toLowerCase(),z.literal("")]).default(""), company:z.string().max(120).default(""), currency }),
  z.object({ action:z.literal("create-invoice"), clientId:z.string().uuid().optional(), customerName:z.string().trim().min(1).max(120).optional(), customerEmail:z.string().trim().email().max(254).optional().or(z.literal("")), customerCompany:z.string().max(120).default(""), saveContact:z.boolean().default(false), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lineItems:z.array(lineItem).min(1).max(50).optional(), documentDesign:documentSettings.optional(), currency, dueDate:date }),
  z.object({ action:z.literal("create-quote"), customerName:z.string().trim().min(1).max(120), customerEmail:z.string().trim().email().max(254).optional().or(z.literal("")), customerCompany:z.string().max(120).default(""), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lineItems:z.array(lineItem).min(1).max(50).optional(), documentDesign:documentSettings.optional(), currency, validUntil:date }),
  z.object({ action:z.literal("update-draft-quote"), quoteId:z.string().uuid(), customerName:z.string().trim().min(1).max(120), customerEmail:z.string().trim().email().max(254).optional().or(z.literal("")), customerCompany:z.string().max(120).default(""), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lineItems:z.array(lineItem).min(1).max(50), documentDesign:documentSettings.optional(), currency, validUntil:date }),
  z.object({ action:z.literal("convert-quote"), quoteId:z.string().uuid(), dueDate:date }),
  z.object({ action:z.literal("update-quote-status"), quoteId:z.string().uuid(), status:z.enum(["Sent","Accepted","Declined"]) }),
  z.object({ action:z.literal("create-expense"), vendor:z.string().trim().min(1).max(160), category:z.string().trim().min(1).max(80), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, notes:z.string().max(500).default(""), receiptObjectKey:z.string().max(300).optional() }),
  z.object({ action:z.literal("update-expense"), expenseId:z.string().uuid(), vendor:z.string().trim().min(1).max(160), category:z.string().trim().min(1).max(80), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, notes:z.string().max(500).default(""), receiptObjectKey:z.string().max(300).nullable().optional() }),
  z.object({ action:z.literal("create-payment"), invoiceId:z.string().uuid(), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, method:z.string().min(1).max(40), reference:z.string().max(100).default(""), notes:z.string().max(500).default("") }),
  z.object({ action:z.literal("send-invoice"), invoiceId:z.string().uuid() }),
  z.object({ action:z.literal("update-draft-invoice"), invoiceId:z.string().uuid(), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lineItems:z.array(lineItem).min(1).max(50), documentDesign:documentSettings.optional(), currency, dueDate:date }),
  z.object({ action:z.literal("delete-draft-invoice"), invoiceId:z.string().uuid() }),

  z.object({ action:z.literal("import-guest-workspace"), importId:z.string().uuid(), businessName:z.string().trim().min(1).max(120), currency, documentSettings:documentSettings.optional(), clients:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(120),email:z.string().trim().email().max(254).toLowerCase(),company:z.string().max(120)})).max(500), invoices:z.array(z.object({id:z.string().uuid(),clientId:z.string().uuid().optional(),customerName:z.string().trim().min(1).max(120).optional(),customerEmail:z.string().max(254).default(""),customerCompany:z.string().max(120).default(""),issueDate:date,dueDate:date,paidAt:date.optional(),description:z.string().trim().min(1).max(500),quantity:z.number().int().min(1).max(1000000),unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),lineItems:z.array(lineItem).min(1).max(50).optional(),documentDesign:documentSettings.optional(),currency,status:z.enum(["Draft","Sent","Paid"])})).max(1000), quotes:z.array(z.object({id:z.string().uuid(),customerName:z.string().trim().min(1).max(120),customerEmail:z.string().max(254),customerCompany:z.string().max(120),description:z.string().trim().min(1).max(500),issueDate:date,validUntil:date,quantity:z.number().int().min(1).max(1000000),unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),lineItems:z.array(lineItem).min(1).max(50).optional(),documentDesign:documentSettings.optional(),currency,status:z.enum(["Draft","Sent","Accepted","Declined","Converted"])})).max(1000).default([]), expenses:z.array(z.object({vendor:z.string().trim().min(1).max(160),category:z.string().trim().min(1).max(80),date,amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),currency})).max(2000) }),

]);

function fail(message:string,status=400){return NextResponse.json({error:message},{status});}
function today(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const part=(type:string)=>parts.find(item=>item.type===type)?.value??"";return part("year")+"-"+part("month")+"-"+part("day");}

export async function GET(request: Request) {
  try {
    return await withDb(async db => {
      const user = await getCurrentUser(db, request.headers);
      if (!user) return fail("Sign in to access your workspace.",401);
      const workspace = await getOrCreateWorkspace(db,user.id);
      return NextResponse.json({ workspace: await loadWorkspace(db,workspace.id) }, { headers: { "Cache-Control":"private, no-store" } });
    });
  } catch (error) {
    console.error("workspace.get",error);
    return fail("Your workspace could not be loaded. Please try again.",500);
  }
}

export async function POST(request:Request) {
  const origin=request.headers.get("origin");
  if(!origin) return fail("A valid same-origin request is required.",403);
  let originUrl:URL;
  try { originUrl=new URL(origin); } catch { return fail("A valid same-origin request is required.",403); }
  const allowedOrigin=originUrl.origin==="https://invoqly.xyz"||originUrl.origin==="https://www.invoqly.xyz"||originUrl.origin==="https://invoqly.vercel.app"||originUrl.origin==="https://invoqly-preview.buttercoder-dev.workers.dev"||originUrl.origin==="https://invoqly-production.buttercoder-dev.workers.dev"||originUrl.origin==="http://localhost:3000"||originUrl.origin==="http://127.0.0.1:3000"||originUrl.origin==="http://localhost:3001"||originUrl.origin==="http://127.0.0.1:3001"||/^https:\/\/invoqly(?:-[a-z0-9-]+)*\.vercel\.app$/.test(originUrl.origin);
  if(!allowedOrigin) return fail("This origin is not allowed to change workspace data.",403);
  if(!(request.headers.get("content-type")||"").toLowerCase().includes("application/json")) return fail("JSON content is required.",415);
  const length=Number(request.headers.get("content-length")||"0");
  if(length>1500000) return fail("The submitted data is too large. Export a smaller guest workspace backup and try again.",413);
  try {
    return await withDb(async db => {
    const user = await getCurrentUser(db, request.headers);
    if (!user) return fail("Sign in to make changes.",401);
    const parsed = payload.safeParse(await request.json());
    if (!parsed.success) return fail("Check the submitted details and try again.",422);
    const input = parsed.data;
    const currentDate=today();
    if(input.action==="create-invoice"&&input.dueDate<currentDate)return fail("Choose an invoice due date that is today or later.",422);
    if((input.action==="create-quote"||input.action==="update-draft-quote")&&input.validUntil<currentDate)return fail("Choose a quotation validity date that is today or later.",422);
    if(input.action==="update-draft-invoice"&&input.dueDate<currentDate)return fail("Choose an invoice due date that is today or later.",422);
    if(input.action==="create-payment"&&input.date>currentDate)return fail("Payment date cannot be in the future.",422);
    const workspace = await getOrCreateWorkspace(db,user.id);

    if (input.action === "import-guest-workspace") {
      if (input.invoices.some(invoice => invoice.clientId ? !input.clients.some(client => client.id === invoice.clientId) : !invoice.customerName)) return fail("An imported invoice is missing its customer details.",422);
      if (input.invoices.some(invoice => invoice.currency !== input.currency) || input.expenses.some(expense => expense.currency !== input.currency)) return fail("All imported records must use the guest workspace currency.",422);
      const invoiceTotals = input.invoices.map(invoice => calculateDocumentTotal(resolveDocumentLineItems(invoice.lineItems,{description:invoice.description,quantity:invoice.quantity,unitPriceMinor:invoice.unitPriceMinor})));
      if (invoiceTotals.some(total => !Number.isSafeInteger(total))) return fail("An imported invoice total exceeds the supported amount range.",422);
      await db.transaction(async tx => {
        await tx.select({id:workspaces.id}).from(workspaces).where(eq(workspaces.id,workspace.id)).for("update");
        const [previousImport] = await tx.select({id:auditEvents.id}).from(auditEvents).where(and(eq(auditEvents.workspaceId,workspace.id),eq(auditEvents.action,"guest.workspace_imported"),eq(auditEvents.entityId,input.importId))).limit(1);
        if (previousImport) return;
        await tx.update(workspaces).set({businessName:input.businessName,defaultCurrency:input.currency,documentSettings:input.documentSettings??workspace.documentSettings,updatedAt:new Date()}).where(eq(workspaces.id,workspace.id));
        const clientIds = new Map<string,string>();
        for (const client of input.clients) {
          const [created] = await tx.insert(clients).values({workspaceId:workspace.id,name:client.name,email:client.email,company:client.company,currency:input.currency}).returning({id:clients.id});
          clientIds.set(client.id,created.id);
        }
        for (const invoice of input.invoices) {
          let clientId = invoice.clientId ? clientIds.get(invoice.clientId) : undefined;
          if (!clientId) { const [oneOff]=await tx.insert(clients).values({workspaceId:workspace.id,name:invoice.customerName!,email:invoice.customerEmail||"",company:invoice.customerCompany||"",currency:input.currency,isOneOff:true}).returning({id:clients.id}); clientId=oneOff.id; }
          const [counter] = await tx.insert(invoiceCounters).values({workspaceId:workspace.id,nextNumber:1})
            .onConflictDoUpdate({target:invoiceCounters.workspaceId,set:{nextNumber:sql`${invoiceCounters.nextNumber} + 1`}})
            .returning({nextNumber:invoiceCounters.nextNumber});
          const number = "INV-" + String(counter.nextNumber).padStart(4,"0");
          const status = invoice.status === "Paid" ? "Paid" : invoice.status === "Sent" ? (invoice.dueDate < today() ? "Overdue" : "Sent") : "Draft";
          const lineItems=resolveDocumentLineItems(invoice.lineItems,{description:invoice.description,quantity:invoice.quantity,unitPriceMinor:invoice.unitPriceMinor});const first=lineItems[0]!;const [created] = await tx.insert(invoices).values({workspaceId:workspace.id,clientId,number,issueDate:invoice.issueDate,dueDate:invoice.dueDate,description:first.description,quantity:first.quantity,unitPriceMinor:first.unitPriceMinor,lineItems,documentDesign:invoice.documentDesign??input.documentSettings??workspace.documentSettings,currency:input.currency,status}).returning({id:invoices.id});
          if (invoice.status === "Paid") {
            await tx.insert(payments).values({workspaceId:workspace.id,invoiceId:created.id,clientId,date:invoice.paidAt ?? today(),amountMinor:invoiceTotals[input.invoices.indexOf(invoice)],currency:input.currency,method:"Guest import",reference:"",notes:"Imported from this device's guest workspace"});
          }
        }
        for (const quote of input.quotes) {
          if (quote.currency !== input.currency) throw new Error("An imported quotation contains an invalid currency.");const validatedQuoteLines=resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor});calculateDocumentTotal(validatedQuoteLines);
          const [counter]=await tx.insert(quoteCounters).values({workspaceId:workspace.id,nextNumber:1}).onConflictDoUpdate({target:quoteCounters.workspaceId,set:{nextNumber:sql`${quoteCounters.nextNumber} + 1`}}).returning({nextNumber:quoteCounters.nextNumber});
          const number="QUO-"+String(counter.nextNumber).padStart(4,"0");
          const lineItems=resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor});const first=lineItems[0]!;await tx.insert(quotes).values({workspaceId:workspace.id,number,customerName:quote.customerName,customerEmail:quote.customerEmail,customerCompany:quote.customerCompany,description:first.description,issueDate:quote.issueDate,validUntil:quote.validUntil,quantity:first.quantity,unitPriceMinor:first.unitPriceMinor,lineItems,documentDesign:quote.documentDesign??input.documentSettings??workspace.documentSettings,currency:quote.currency,status:quote.status});
        }
        for (const expense of input.expenses) {
          await tx.insert(expenses).values({workspaceId:workspace.id,vendor:expense.vendor,category:expense.category,date:expense.date,amountMinor:expense.amountMinor,currency:input.currency,notes:"Imported from this device's guest workspace"});
        }
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"guest.workspace_imported",entityType:"guest_import",entityId:input.importId,metadata:{clients:input.clients.length,invoices:input.invoices.length,expenses:input.expenses.length,quotes:input.quotes.length}});
      });
    }

    if (input.action === "update-document-settings") {
      await db.update(workspaces).set({documentSettings:input.documentSettings,updatedAt:new Date()}).where(eq(workspaces.id,workspace.id));
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"workspace.document_settings_updated",entityType:"workspace",entityId:workspace.id,metadata:{templateId:input.documentSettings.templateId}});
    }

    if (input.action === "update-settings") {
      if (input.vatRegistered ?? workspace.vatRegistered) {
        if (!/^\d{10}$/.test(input.vatNumber ?? workspace.vatNumber ?? "")) {
          return fail("Enter the 10-digit SARS VAT registration number before enabling VAT invoicing.", 422);
        }
        if (!(input.businessAddress ?? workspace.businessAddress ?? "").trim()) {
          return fail("Enter your business address before enabling VAT tax-invoice details.", 422);
        }
      }
      await db.transaction(async tx => {
        await tx.update(workspaces).set({
          businessName: input.businessName,
          defaultCurrency: input.currency,
          locale: input.locale,
          vatRegistered: input.vatRegistered ?? workspace.vatRegistered,
          vatNumber: input.vatNumber ?? workspace.vatNumber,
          businessAddress: input.businessAddress ?? workspace.businessAddress,
          openingCashBalanceMinor: input.openingCashBalanceMinor === undefined ? workspace.openingCashBalanceMinor : input.openingCashBalanceMinor,
          cashReserveMinor: input.cashReserveMinor ?? workspace.cashReserveMinor,
          updatedAt: new Date()
        }).where(eq(workspaces.id, workspace.id));
        await tx.insert(auditEvents).values({
          workspaceId: workspace.id, actorUserId: user.id, action: "workspace.updated",
          entityType: "workspace", entityId: workspace.id,
          metadata: { currency: input.currency, vatRegistered: input.vatRegistered ?? workspace.vatRegistered }
        });
      });
    }

    if (input.action === "create-client") {
      await db.transaction(async tx=>{
        const [created] = await tx.insert(clients).values({workspaceId:workspace.id,name:input.name,email:input.email,company:input.company,currency:input.currency}).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"client.created",entityType:"client",entityId:created.id,metadata:{currency:created.currency}});
      });
    }

    if (input.action === "update-client") {
      const updated=await db.transaction(async tx=>{
        const [existing]=await tx.select().from(clients).where(and(eq(clients.id,input.clientId),eq(clients.workspaceId,workspace.id),eq(clients.isOneOff,false))).for("update").limit(1);
        if(!existing)return null;
        const [saved]=await tx.update(clients).set({name:input.name,email:input.email,company:input.company,currency:input.currency,updatedAt:new Date()}).where(and(eq(clients.id,existing.id),eq(clients.workspaceId,workspace.id))).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"client.updated",entityType:"client",entityId:existing.id,metadata:{previous:{name:existing.name,email:existing.email,company:existing.company,currency:existing.currency},next:{name:input.name,email:input.email,company:input.company,currency:input.currency}}});
        return saved;
      });
      if(!updated)return fail("Client not found.",404);
    }

    if (input.action === "create-invoice") {
      let lineItems: DocumentLineItem[];
      let documentTotal: number;
      try {
        lineItems = applyDocumentTaxProfile(resolveDocumentLineItems(input.lineItems, { description: input.description, quantity: input.quantity, unitPriceMinor: input.unitPriceMinor }), { vatRegistered: workspace.vatRegistered, taxDate: today(), priceMode: "inclusive" });
        documentTotal = calculateDocumentTotal(lineItems);
      } catch (error) { return fail(error instanceof Error ? error.message : "Invoice line items are invalid.",422); }
      if (!Number.isSafeInteger(documentTotal)) return fail("The invoice total exceeds the supported amount range.",422);
      if (!input.clientId && !input.customerName) return fail("Enter a customer name or choose a saved customer.",422);
      const result = await db.transaction(async tx => {
        let clientId = input.clientId;
        if (clientId) {
          const [client] = await tx.select().from(clients).where(and(eq(clients.id,clientId),eq(clients.workspaceId,workspace.id))).limit(1);
          if (!client) throw new Error("The selected client does not exist in this workspace.");
        } else {
          const [createdClient] = await tx.insert(clients).values({workspaceId:workspace.id,name:input.customerName!,email:input.customerEmail||"",company:input.customerCompany,isOneOff:!input.saveContact,currency:input.currency}).returning({id:clients.id});
          clientId = createdClient.id;
        }
        const [counter] = await tx.insert(invoiceCounters).values({workspaceId:workspace.id,nextNumber:1})
          .onConflictDoUpdate({target:invoiceCounters.workspaceId,set:{nextNumber:sql`${invoiceCounters.nextNumber} + 1`}})
          .returning({nextNumber:invoiceCounters.nextNumber});
        const number = "INV-" + String(counter.nextNumber).padStart(4,"0");
        const [created] = await tx.insert(invoices).values({workspaceId:workspace.id,clientId,number,issueDate:today(),dueDate:input.dueDate,description:lineItems[0]!.description,quantity:lineItems[0]!.quantity,unitPriceMinor:lineItems[0]!.unitPriceMinor,lineItems,documentDesign:input.documentDesign??workspace.documentSettings,currency:input.currency,status:"Draft"}).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.created",entityType:"invoice",entityId:created.id,metadata:{number,currency:input.currency}});
        return created;
      });
      void result;
    }

    if (input.action === "update-draft-invoice") {
      let lineItems: DocumentLineItem[];
      try {
        lineItems = applyDocumentTaxProfile(resolveDocumentLineItems(input.lineItems, { description: input.description, quantity: input.quantity, unitPriceMinor: input.unitPriceMinor }), { vatRegistered: workspace.vatRegistered, taxDate: today(), priceMode: "inclusive" });
        calculateDocumentTotal(lineItems);
      } catch (error) { return fail(error instanceof Error ? error.message : "Invoice line items are invalid.",422); }
      const updated = await db.transaction(async tx => {
        const [existing] = await tx.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).limit(1);
        if (!existing) return null;
        if (existing.status !== "Draft") throw new Error("Only draft invoices can be edited. Issued invoices are retained as financial records.");
        const [payment] = await tx.select({id:payments.id}).from(payments).where(and(eq(payments.invoiceId,existing.id),eq(payments.workspaceId,workspace.id))).limit(1);
        if (payment) throw new Error("An invoice with recorded payments cannot be edited.");
        const [saved] = await tx.update(invoices).set({
          description:lineItems[0]!.description, quantity:lineItems[0]!.quantity,
          unitPriceMinor:lineItems[0]!.unitPriceMinor, lineItems, documentDesign:input.documentDesign??existing.documentDesign??workspace.documentSettings, currency:input.currency, dueDate:input.dueDate
        }).where(and(eq(invoices.id,existing.id),eq(invoices.workspaceId,workspace.id),eq(invoices.status,"Draft"))).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.draft_updated",entityType:"invoice",entityId:existing.id,metadata:{number:existing.number}});
        return saved;
      });
      if (!updated) return fail("Invoice not found in this workspace.",404);
    }

    if (input.action === "create-quote") {
      let lineItems: DocumentLineItem[];
      let documentTotal: number;
      try {
        lineItems = applyDocumentTaxProfile(resolveDocumentLineItems(input.lineItems, { description: input.description, quantity: input.quantity, unitPriceMinor: input.unitPriceMinor }), { vatRegistered: workspace.vatRegistered, taxDate: today(), priceMode: "inclusive" });
        documentTotal = calculateDocumentTotal(lineItems);
      } catch (error) { return fail(error instanceof Error ? error.message : "Quotation line items are invalid.",422); }
      if (!Number.isSafeInteger(documentTotal)) return fail("The quotation total exceeds the supported amount range.",422);
      await db.transaction(async tx=>{const [counter]=await tx.insert(quoteCounters).values({workspaceId:workspace.id,nextNumber:1}).onConflictDoUpdate({target:quoteCounters.workspaceId,set:{nextNumber:sql`${quoteCounters.nextNumber} + 1`}}).returning({nextNumber:quoteCounters.nextNumber});const number="QUO-"+String(counter.nextNumber).padStart(4,"0");const [created]=await tx.insert(quotes).values({workspaceId:workspace.id,number,customerName:input.customerName,customerEmail:input.customerEmail||"",customerCompany:input.customerCompany,issueDate:today(),validUntil:input.validUntil,description:lineItems[0]!.description,quantity:lineItems[0]!.quantity,unitPriceMinor:lineItems[0]!.unitPriceMinor,lineItems,documentDesign:input.documentDesign??workspace.documentSettings,currency:input.currency,status:"Draft"}).returning();await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.created",entityType:"quote",entityId:created.id,metadata:{number,currency:input.currency}})});
    }
    if (input.action === "update-draft-quote") {
      let lineItems:DocumentLineItem[];
      let total:number;
      try {
        lineItems=applyDocumentTaxProfile(resolveDocumentLineItems(input.lineItems,{description:input.description,quantity:input.quantity,unitPriceMinor:input.unitPriceMinor}),{vatRegistered:workspace.vatRegistered,taxDate:today(),priceMode:"inclusive"});
        total=calculateDocumentTotal(lineItems);
      } catch(error) { return fail(error instanceof Error?error.message:"Quotation line items are invalid.",422); }
      if(!Number.isSafeInteger(total))return fail("The quotation total exceeds the supported amount range.",422);
      const result=await db.transaction(async tx=>{
        const [existing]=await tx.select().from(quotes).where(and(eq(quotes.id,input.quoteId),eq(quotes.workspaceId,workspace.id))).for("update").limit(1);
        if(!existing)return "not-found" as const;
        if(existing.status!=="Draft")return "not-draft" as const;
        await tx.update(quotes).set({customerName:input.customerName,customerEmail:input.customerEmail??"",customerCompany:input.customerCompany,description:lineItems[0]!.description,quantity:lineItems[0]!.quantity,unitPriceMinor:lineItems[0]!.unitPriceMinor,lineItems,documentDesign:input.documentDesign??existing.documentDesign??workspace.documentSettings,currency:input.currency,validUntil:input.validUntil,updatedAt:new Date()}).where(and(eq(quotes.id,existing.id),eq(quotes.workspaceId,workspace.id),eq(quotes.status,"Draft")));
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.draft_updated",entityType:"quote",entityId:existing.id,metadata:{currency:input.currency,validUntil:input.validUntil,lineCount:lineItems.length}});
        return "ok" as const;
      });
      if(result==="not-found")return fail("Quotation not found.",404);
      if(result==="not-draft")return fail("Only draft quotations can be edited. Sent or decided quotations are retained as records.",409);
    }

    if (input.action === "update-quote-status") {
      const result=await db.transaction(async tx=>{
        const [quote]=await tx.select().from(quotes).where(and(eq(quotes.id,input.quoteId),eq(quotes.workspaceId,workspace.id))).for("update").limit(1);
        if(!quote)return "not-found" as const;
        const allowed:Record<string,string[]>={Draft:["Sent"],Sent:["Accepted","Declined"]};
        if(!(allowed[quote.status]??[]).includes(input.status))return "invalid-transition" as const;
        await tx.update(quotes).set({status:input.status,updatedAt:new Date()}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,workspace.id)));
        if(input.status==="Accepted"||input.status==="Declined") await tx.update(quotePublicLinks).set({revokedAt:new Date()}).where(and(eq(quotePublicLinks.workspaceId,workspace.id),eq(quotePublicLinks.quoteId,quote.id),eq(quotePublicLinks.decisionStatus,"Pending")));
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.status_changed",entityType:"quote",entityId:quote.id,metadata:{previousStatus:quote.status,status:input.status}});
        return "ok" as const;
      });
      if(result==="not-found")return fail("Quotation not found.",404);
      if(result==="invalid-transition")return fail("A draft quotation can only be sent; a sent quotation can only be accepted or declined.",409);
    }
    if (input.action === "convert-quote") {
      const converted=await db.transaction(async tx=>{const [quote]=await tx.select().from(quotes).where(and(eq(quotes.id,input.quoteId),eq(quotes.workspaceId,workspace.id))).for("update").limit(1);if(!quote)return {error:"not-found" as const};if(quote.status!=="Accepted")return {error:"not-accepted" as const};if(quote.convertedInvoiceId)return {error:"converted" as const};const [client]=await tx.insert(clients).values({workspaceId:workspace.id,name:quote.customerName,email:quote.customerEmail,company:quote.customerCompany,isOneOff:true,currency:quote.currency}).returning({id:clients.id});const [counter]=await tx.insert(invoiceCounters).values({workspaceId:workspace.id,nextNumber:1}).onConflictDoUpdate({target:invoiceCounters.workspaceId,set:{nextNumber:sql`${invoiceCounters.nextNumber} + 1`}}).returning({nextNumber:invoiceCounters.nextNumber});const number="INV-"+String(counter.nextNumber).padStart(4,"0");const [invoice]=await tx.insert(invoices).values({workspaceId:workspace.id,clientId:client.id,number,issueDate:today(),dueDate:input.dueDate,description:quote.lineItems?.[0]?.description??quote.description,quantity:quote.lineItems?.[0]?.quantity??quote.quantity,unitPriceMinor:quote.lineItems?.[0]?.unitPriceMinor??quote.unitPriceMinor,lineItems:resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor}),documentDesign:quote.documentDesign??workspace.documentSettings,currency:quote.currency,status:"Draft"}).returning({id:invoices.id});await tx.update(quotePublicLinks).set({revokedAt:new Date()}).where(and(eq(quotePublicLinks.workspaceId,workspace.id),eq(quotePublicLinks.quoteId,quote.id),eq(quotePublicLinks.decisionStatus,"Pending")));await tx.update(quotes).set({status:"Converted",convertedInvoiceId:invoice.id,updatedAt:new Date()}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,workspace.id)));await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.converted",entityType:"quote",entityId:quote.id,metadata:{invoiceId:invoice.id,number}});return {ok:true as const}});
      if("error" in converted)return converted.error==="not-found"?fail("Quotation not found.",404):fail(converted.error==="not-accepted"?"Accept the quotation before converting it.":"This quotation has already been converted.",409);
    }

    if (input.action === "create-expense") {
      if (input.receiptObjectKey) {
        const prefix = workspace.id + "/expenses/";
        if (!input.receiptObjectKey.startsWith(prefix) || input.receiptObjectKey.includes("..")) throw new Error("The receipt attachment does not belong to this workspace.");
        if (!(await headReceiptObject(input.receiptObjectKey))) throw new Error("The receipt upload could not be found. Upload it again before saving the expense.");
      }
      await db.transaction(async tx=>{
        const [created] = await tx.insert(expenses).values({workspaceId:workspace.id,vendor:input.vendor,category:input.category,date:input.date,amountMinor:input.amountMinor,currency:input.currency,notes:input.notes,receiptObjectKey:input.receiptObjectKey??null}).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"expense.created",entityType:"expense",entityId:created.id,metadata:{amountMinor:created.amountMinor,currency:created.currency,receiptAttached:Boolean(created.receiptObjectKey)}});
      });
    }

    if (input.action === "update-expense") {
      if(input.receiptObjectKey){const prefix=workspace.id+"/expenses/";if(!input.receiptObjectKey.startsWith(prefix)||input.receiptObjectKey.includes(".."))throw new Error("The receipt attachment does not belong to this workspace.");if(!(await headReceiptObject(input.receiptObjectKey)))throw new Error("The receipt upload could not be found. Upload it again before saving the expense.");}
      const updated=await db.transaction(async tx=>{
        const [existing]=await tx.select().from(expenses).where(and(eq(expenses.id,input.expenseId),eq(expenses.workspaceId,workspace.id))).for("update").limit(1);
        if(!existing)return null;
        const nextReceiptKey=input.receiptObjectKey===undefined?existing.receiptObjectKey:input.receiptObjectKey;
        const [saved]=await tx.update(expenses).set({vendor:input.vendor,category:input.category,date:input.date,amountMinor:input.amountMinor,currency:input.currency,notes:input.notes,receiptObjectKey:nextReceiptKey}).where(and(eq(expenses.id,existing.id),eq(expenses.workspaceId,workspace.id))).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"expense.updated",entityType:"expense",entityId:existing.id,metadata:{before:{vendor:existing.vendor,category:existing.category,date:existing.date,amountMinor:existing.amountMinor,currency:existing.currency,receiptAttached:Boolean(existing.receiptObjectKey)},after:{vendor:saved.vendor,category:saved.category,date:saved.date,amountMinor:saved.amountMinor,currency:saved.currency,receiptAttached:Boolean(saved.receiptObjectKey)}}});
        return saved;
      });
      if(!updated)return fail("Expense not found.",404);
    }

    if (input.action === "create-payment") {
      await db.transaction(async tx => {
        const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).for("update").limit(1);
        if (!invoice || invoice.status === "Draft") throw new Error("Choose an issued invoice in this workspace.");
        if (input.currency !== invoice.currency) throw new Error("Payment currency must match the invoice currency.");
        const existing = await tx.select({amount:sql<string>`coalesce(sum(${payments.amountMinor}),0)::text`}).from(payments).where(and(eq(payments.invoiceId,invoice.id),eq(payments.workspaceId,workspace.id)));
        const paid = Number(existing[0]?.amount ?? "0");
        if (!Number.isSafeInteger(paid)) throw new Error("The existing payment total exceeds the supported amount.");
        const invoiceTotal = calculateDocumentTotal(resolveDocumentLineItems(invoice.lineItems, { description: invoice.description, quantity: invoice.quantity, unitPriceMinor: invoice.unitPriceMinor }));
        if (!Number.isSafeInteger(invoiceTotal)) throw new Error("The invoice total exceeds the supported amount range.");
        const balance = outstandingBalanceMinor(invoiceTotal, [paid]);
        if (input.amountMinor > balance) throw new Error("Payment cannot exceed the outstanding invoice balance.");
        const nextStatus = deriveInvoiceStatus(invoiceTotal, paid + input.amountMinor, invoice.dueDate, today());
        const [payment] = await tx.insert(payments).values({workspaceId:workspace.id,invoiceId:invoice.id,clientId:invoice.clientId,date:input.date,amountMinor:input.amountMinor,currency:input.currency,method:input.method,reference:input.reference,notes:input.notes}).returning();
        await tx.update(invoices).set({status:nextStatus,updatedAt:new Date()}).where(and(eq(invoices.id,invoice.id),eq(invoices.workspaceId,workspace.id)));
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"payment.recorded",entityType:"payment",entityId:payment.id,metadata:{invoiceId:invoice.id,amountMinor:input.amountMinor,currency:input.currency}});
      });
    }

    if (input.action === "send-invoice") {
      const issueResult = await db.transaction(async tx=>{
        const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).for("update").limit(1);
        if (!invoice) return {error:"not-found" as const};
        if (invoice.status !== "Draft") return {error:"not-draft" as const};
        const status = invoice.dueDate < today() ? "Overdue" : "Sent";
        await tx.update(invoices).set({status,updatedAt:new Date()}).where(and(eq(invoices.id,invoice.id),eq(invoices.workspaceId,workspace.id)));
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.issued",entityType:"invoice",entityId:invoice.id,metadata:{number:invoice.number}});
        return {ok:true as const};
      });
      if ("error" in issueResult) return issueResult.error==="not-found"?fail("Invoice not found.",404):fail("Only draft invoices can be issued.",409);
    }

    if (input.action === "delete-draft-invoice") {
      const deleteResult = await db.transaction(async tx=>{
        const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).for("update").limit(1);
        if (!invoice) return {error:"not-found" as const};
        if (invoice.status !== "Draft") return {error:"not-draft" as const};
        await tx.delete(invoices).where(and(eq(invoices.id,invoice.id),eq(invoices.workspaceId,workspace.id)));
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.draft_deleted",entityType:"invoice",entityId:invoice.id,metadata:{number:invoice.number}});
        return {ok:true as const};
      });
      if ("error" in deleteResult) return deleteResult.error==="not-found"?fail("Invoice not found.",404):fail("Issued invoices are retained as financial records.",409);
    }

    return NextResponse.json({ ok:true, workspace:await loadWorkspace(db,workspace.id) }, { headers: { "Cache-Control":"private, no-store" } });
    });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The change could not be saved.";
    if (/Choose an issued invoice|currency must match|cannot exceed|exceeds the supported/i.test(message)) return fail(message,409);
    console.error("workspace.mutation",error);
    return fail(message === "The change could not be saved." ? message : "The change could not be saved. Please try again.",500);
  }
}
