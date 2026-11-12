import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { withDb } from "@/lib/db";
import { auditEvents, clients, expenses, invoiceCounters, invoices, payments, quoteCounters, quotes, workspaces } from "@/lib/db/schema";
import { getCurrentUser, getOrCreateWorkspace, loadWorkspace } from "@/lib/workspace";
import { deriveInvoiceStatus, outstandingBalanceMinor } from "@/lib/billing";
import { applyDocumentTaxProfile, calculateDocumentTotal, resolveDocumentLineItems, type DocumentLineItem } from "@/lib/documents";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currency = z.string().regex(/^[A-Z]{3}$/).refine(value=>{try{new Intl.NumberFormat("en",{style:"currency",currency:value}).format(0);return true}catch{return false}},"Choose a supported ISO currency code.");
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/).refine(value=>{const [year,month,day]=value.split("-").map(Number);const parsed=new Date(Date.UTC(year,month-1,day));return parsed.getUTCFullYear()===year&&parsed.getUTCMonth()===month-1&&parsed.getUTCDate()===day},"Enter a real calendar date.");
const lineItem = z.object({description:z.string().trim().min(1).max(500),quantity:z.number().int().min(1).max(1000000),unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),taxTreatment:z.enum(["standard","zero_rated","exempt","out_of_scope"]).optional(),priceMode:z.enum(["inclusive","exclusive"]).optional()});
const payload = z.discriminatedUnion("action", [
  z.object({ action:z.literal("update-settings"), businessName:z.string().trim().min(1).max(120), currency, locale:z.string().min(2).max(20), vatRegistered:z.boolean().optional(), vatNumber:z.string().trim().max(10).optional(), businessAddress:z.string().trim().max(250).optional() }),
  z.object({ action:z.literal("create-client"), name:z.string().trim().min(1).max(120), email:z.string().trim().email().max(254).toLowerCase(), company:z.string().max(120).default(""), currency }),
  z.object({ action:z.literal("create-invoice"), clientId:z.string().uuid().optional(), customerName:z.string().trim().min(1).max(120).optional(), customerEmail:z.string().trim().email().max(254).optional().or(z.literal("")), customerCompany:z.string().max(120).default(""), saveContact:z.boolean().default(false), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lineItems:z.array(lineItem).min(1).max(50).optional(), currency, dueDate:date }),
  z.object({ action:z.literal("create-quote"), customerName:z.string().trim().min(1).max(120), customerEmail:z.string().trim().email().max(254).optional().or(z.literal("")), customerCompany:z.string().max(120).default(""), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), lineItems:z.array(lineItem).min(1).max(50).optional(), currency, validUntil:date }),
  z.object({ action:z.literal("convert-quote"), quoteId:z.string().uuid(), dueDate:date }),
  z.object({ action:z.literal("update-quote-status"), quoteId:z.string().uuid(), status:z.enum(["Sent","Accepted","Declined"]) }),
  z.object({ action:z.literal("create-expense"), vendor:z.string().trim().min(1).max(160), category:z.string().trim().min(1).max(80), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, notes:z.string().max(500).default("") }),
  z.object({ action:z.literal("create-payment"), invoiceId:z.string().uuid(), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, method:z.string().min(1).max(40), reference:z.string().max(100).default(""), notes:z.string().max(500).default("") }),
  z.object({ action:z.literal("send-invoice"), invoiceId:z.string().uuid() }),
  z.object({ action:z.literal("delete-draft-invoice"), invoiceId:z.string().uuid() }),

  z.object({ action:z.literal("import-guest-workspace"), importId:z.string().uuid(), businessName:z.string().trim().min(1).max(120), currency, clients:z.array(z.object({id:z.string().uuid(),name:z.string().trim().min(1).max(120),email:z.string().trim().email().max(254).toLowerCase(),company:z.string().max(120)})).max(500), invoices:z.array(z.object({id:z.string().uuid(),clientId:z.string().uuid().optional(),customerName:z.string().trim().min(1).max(120).optional(),customerEmail:z.string().max(254).default(""),customerCompany:z.string().max(120).default(""),issueDate:date,dueDate:date,paidAt:date.optional(),description:z.string().trim().min(1).max(500),quantity:z.number().int().min(1).max(1000000),unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),lineItems:z.array(lineItem).min(1).max(50).optional(),currency,status:z.enum(["Draft","Sent","Paid"])})).max(1000), quotes:z.array(z.object({id:z.string().uuid(),customerName:z.string().trim().min(1).max(120),customerEmail:z.string().max(254),customerCompany:z.string().max(120),description:z.string().trim().min(1).max(500),issueDate:date,validUntil:date,quantity:z.number().int().min(1).max(1000000),unitPriceMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),lineItems:z.array(lineItem).min(1).max(50).optional(),currency,status:z.enum(["Draft","Sent","Accepted","Declined","Converted"])})).max(1000).default([]), expenses:z.array(z.object({vendor:z.string().trim().min(1).max(160),category:z.string().trim().min(1).max(80),date,amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER),currency})).max(2000) }),

]);

function fail(message:string,status=400){return NextResponse.json({error:message},{status});}
function today(){const parts=new Intl.DateTimeFormat("en-CA",{timeZone:"Africa/Johannesburg",year:"numeric",month:"2-digit",day:"2-digit"}).formatToParts(new Date());const part=(type:string)=>parts.find(item=>item.type===type)?.value??"";return part("year")+"-"+part("month")+"-"+part("day");}

export async function GET() {
  try {
    return await withDb(async db => {
      const user = await getCurrentUser(db);
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
    const user = await getCurrentUser(db);
    if (!user) return fail("Sign in to make changes.",401);
    const parsed = payload.safeParse(await request.json());
    if (!parsed.success) return fail("Check the submitted details and try again.",422);
    const input = parsed.data;
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
        await tx.update(workspaces).set({businessName:input.businessName,defaultCurrency:input.currency,updatedAt:new Date()}).where(eq(workspaces.id,workspace.id));
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
          const lineItems=resolveDocumentLineItems(invoice.lineItems,{description:invoice.description,quantity:invoice.quantity,unitPriceMinor:invoice.unitPriceMinor});const first=lineItems[0]!;const [created] = await tx.insert(invoices).values({workspaceId:workspace.id,clientId,number,issueDate:invoice.issueDate,dueDate:invoice.dueDate,description:first.description,quantity:first.quantity,unitPriceMinor:first.unitPriceMinor,lineItems,currency:input.currency,status}).returning({id:invoices.id});
          if (invoice.status === "Paid") {
            await tx.insert(payments).values({workspaceId:workspace.id,invoiceId:created.id,clientId,date:invoice.paidAt ?? today(),amountMinor:invoiceTotals[input.invoices.indexOf(invoice)],currency:input.currency,method:"Guest import",reference:"",notes:"Imported from this device's guest workspace"});
          }
        }
        for (const quote of input.quotes) {
          if (quote.currency !== input.currency) throw new Error("An imported quotation contains an invalid currency.");const validatedQuoteLines=resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor});calculateDocumentTotal(validatedQuoteLines);
          const [counter]=await tx.insert(quoteCounters).values({workspaceId:workspace.id,nextNumber:1}).onConflictDoUpdate({target:quoteCounters.workspaceId,set:{nextNumber:sql`${quoteCounters.nextNumber} + 1`}}).returning({nextNumber:quoteCounters.nextNumber});
          const number="QUO-"+String(counter.nextNumber).padStart(4,"0");
          const lineItems=resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor});const first=lineItems[0]!;await tx.insert(quotes).values({workspaceId:workspace.id,number,customerName:quote.customerName,customerEmail:quote.customerEmail,customerCompany:quote.customerCompany,description:first.description,issueDate:quote.issueDate,validUntil:quote.validUntil,quantity:first.quantity,unitPriceMinor:first.unitPriceMinor,lineItems,currency:quote.currency,status:quote.status});
        }
        for (const expense of input.expenses) {
          await tx.insert(expenses).values({workspaceId:workspace.id,vendor:expense.vendor,category:expense.category,date:expense.date,amountMinor:expense.amountMinor,currency:input.currency,notes:"Imported from this device's guest workspace"});
        }
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"guest.workspace_imported",entityType:"guest_import",entityId:input.importId,metadata:{clients:input.clients.length,invoices:input.invoices.length,expenses:input.expenses.length,quotes:input.quotes.length}});
      });
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
        const [created] = await tx.insert(invoices).values({workspaceId:workspace.id,clientId,number,issueDate:today(),dueDate:input.dueDate,description:lineItems[0]!.description,quantity:lineItems[0]!.quantity,unitPriceMinor:lineItems[0]!.unitPriceMinor,lineItems,currency:input.currency,status:"Draft"}).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.created",entityType:"invoice",entityId:created.id,metadata:{number,currency:input.currency}});
        return created;
      });
      void result;
    }

    if (input.action === "create-quote") {
      let lineItems: DocumentLineItem[];
      let documentTotal: number;
      try {
        lineItems = applyDocumentTaxProfile(resolveDocumentLineItems(input.lineItems, { description: input.description, quantity: input.quantity, unitPriceMinor: input.unitPriceMinor }), { vatRegistered: workspace.vatRegistered, taxDate: today(), priceMode: "inclusive" });
        documentTotal = calculateDocumentTotal(lineItems);
      } catch (error) { return fail(error instanceof Error ? error.message : "Quotation line items are invalid.",422); }
      if (!Number.isSafeInteger(documentTotal)) return fail("The quotation total exceeds the supported amount range.",422);
      await db.transaction(async tx=>{const [counter]=await tx.insert(quoteCounters).values({workspaceId:workspace.id,nextNumber:1}).onConflictDoUpdate({target:quoteCounters.workspaceId,set:{nextNumber:sql`${quoteCounters.nextNumber} + 1`}}).returning({nextNumber:quoteCounters.nextNumber});const number="QUO-"+String(counter.nextNumber).padStart(4,"0");const [created]=await tx.insert(quotes).values({workspaceId:workspace.id,number,customerName:input.customerName,customerEmail:input.customerEmail||"",customerCompany:input.customerCompany,issueDate:today(),validUntil:input.validUntil,description:lineItems[0]!.description,quantity:lineItems[0]!.quantity,unitPriceMinor:lineItems[0]!.unitPriceMinor,lineItems,currency:input.currency,status:"Draft"}).returning();await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.created",entityType:"quote",entityId:created.id,metadata:{number,currency:input.currency}})});
    }
    if (input.action === "update-quote-status") {
      const [quote]=await db.select().from(quotes).where(and(eq(quotes.id,input.quoteId),eq(quotes.workspaceId,workspace.id))).limit(1);
      if(!quote||quote.status==="Converted")return fail("This quotation can no longer be changed.",409);
      await db.update(quotes).set({status:input.status,updatedAt:new Date()}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,workspace.id)));
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.status_changed",entityType:"quote",entityId:quote.id,metadata:{status:input.status}});
    }
    if (input.action === "convert-quote") {
      const converted=await db.transaction(async tx=>{const [quote]=await tx.select().from(quotes).where(and(eq(quotes.id,input.quoteId),eq(quotes.workspaceId,workspace.id))).for("update").limit(1);if(!quote)return {error:"not-found" as const};if(quote.status!=="Accepted")return {error:"not-accepted" as const};if(quote.convertedInvoiceId)return {error:"converted" as const};const [client]=await tx.insert(clients).values({workspaceId:workspace.id,name:quote.customerName,email:quote.customerEmail,company:quote.customerCompany,isOneOff:true,currency:quote.currency}).returning({id:clients.id});const [counter]=await tx.insert(invoiceCounters).values({workspaceId:workspace.id,nextNumber:1}).onConflictDoUpdate({target:invoiceCounters.workspaceId,set:{nextNumber:sql`${invoiceCounters.nextNumber} + 1`}}).returning({nextNumber:invoiceCounters.nextNumber});const number="INV-"+String(counter.nextNumber).padStart(4,"0");const [invoice]=await tx.insert(invoices).values({workspaceId:workspace.id,clientId:client.id,number,issueDate:today(),dueDate:input.dueDate,description:quote.lineItems?.[0]?.description??quote.description,quantity:quote.lineItems?.[0]?.quantity??quote.quantity,unitPriceMinor:quote.lineItems?.[0]?.unitPriceMinor??quote.unitPriceMinor,lineItems:resolveDocumentLineItems(quote.lineItems,{description:quote.description,quantity:quote.quantity,unitPriceMinor:quote.unitPriceMinor}),currency:quote.currency,status:"Draft"}).returning({id:invoices.id});await tx.update(quotes).set({status:"Converted",convertedInvoiceId:invoice.id,updatedAt:new Date()}).where(and(eq(quotes.id,quote.id),eq(quotes.workspaceId,workspace.id)));await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"quote.converted",entityType:"quote",entityId:quote.id,metadata:{invoiceId:invoice.id,number}});return {ok:true as const}});
      if("error" in converted)return converted.error==="not-found"?fail("Quotation not found.",404):fail(converted.error==="not-accepted"?"Accept the quotation before converting it.":"This quotation has already been converted.",409);
    }

    if (input.action === "create-expense") {
      await db.transaction(async tx=>{
        const [created] = await tx.insert(expenses).values({workspaceId:workspace.id,vendor:input.vendor,category:input.category,date:input.date,amountMinor:input.amountMinor,currency:input.currency,notes:input.notes}).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"expense.created",entityType:"expense",entityId:created.id,metadata:{amountMinor:created.amountMinor,currency:created.currency}});
      });
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
