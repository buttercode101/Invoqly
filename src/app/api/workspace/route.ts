import { and, eq, sql } from "drizzle-orm";
import { NextResponse } from "next/server";
import { z } from "zod";
import { db } from "@/lib/db";
import { auditEvents, clients, expenses, invoiceCounters, invoices, payments, workspaces } from "@/lib/db/schema";
import { getCurrentUser, getOrCreateWorkspace, loadWorkspace } from "@/lib/workspace";
import { deriveInvoiceStatus, outstandingBalanceMinor } from "@/lib/billing";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const currency = z.string().regex(/^[A-Z]{3}$/);
const date = z.string().regex(/^\d{4}-\d{2}-\d{2}$/);
const payload = z.discriminatedUnion("action", [
  z.object({ action:z.literal("update-settings"), businessName:z.string().trim().min(1).max(120), currency, locale:z.string().min(2).max(20) }),
  z.object({ action:z.literal("create-client"), name:z.string().trim().min(1).max(120), email:z.string().trim().email().max(254), company:z.string().max(120).default(""), currency }),
  z.object({ action:z.literal("create-invoice"), clientId:z.string().uuid(), description:z.string().trim().min(1).max(500), quantity:z.number().int().min(1).max(1000000), unitPriceMinor:z.number().int().min(0).max(Number.MAX_SAFE_INTEGER), currency, dueDate:date }),
  z.object({ action:z.literal("create-expense"), vendor:z.string().trim().min(1).max(160), category:z.string().trim().min(1).max(80), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, notes:z.string().max(500).default("") }),
  z.object({ action:z.literal("create-payment"), invoiceId:z.string().uuid(), date, amountMinor:z.number().int().positive().max(Number.MAX_SAFE_INTEGER), currency, method:z.string().min(1).max(40), reference:z.string().max(100).default(""), notes:z.string().max(500).default("") }),
  z.object({ action:z.literal("send-invoice"), invoiceId:z.string().uuid() }),
  z.object({ action:z.literal("delete-draft-invoice"), invoiceId:z.string().uuid() }),
]);

function fail(message:string,status=400){return NextResponse.json({error:message},{status});}
function today(){return new Date().toISOString().slice(0,10);}

export async function GET() {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Sign in to access your workspace.",401);
    const workspace = await getOrCreateWorkspace(user.id);
    return NextResponse.json({ workspace: await loadWorkspace(workspace.id) }, { headers: { "Cache-Control":"private, no-store" } });
  } catch (error) {
    console.error("workspace.get",error);
    return fail("Your workspace could not be loaded. Please try again.",500);
  }
}

export async function POST(request:Request) {
  try {
    const user = await getCurrentUser();
    if (!user) return fail("Sign in to make changes.",401);
    const parsed = payload.safeParse(await request.json());
    if (!parsed.success) return fail("Check the submitted details and try again.",422);
    const input = parsed.data;
    const workspace = await getOrCreateWorkspace(user.id);

    if (input.action === "update-settings") {
      await db.update(workspaces).set({ businessName:input.businessName, defaultCurrency:input.currency, locale:input.locale, updatedAt:new Date() }).where(eq(workspaces.id,workspace.id));
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"workspace.updated",entityType:"workspace",entityId:workspace.id,metadata:{currency:input.currency}});
    }

    if (input.action === "create-client") {
      const [created] = await db.insert(clients).values({workspaceId:workspace.id,name:input.name,email:input.email,company:input.company,currency:input.currency}).returning();
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"client.created",entityType:"client",entityId:created.id,metadata:{currency:created.currency}});
    }

    if (input.action === "create-invoice") {
      const [client] = await db.select().from(clients).where(and(eq(clients.id,input.clientId),eq(clients.workspaceId,workspace.id))).limit(1);
      if (!client) return fail("The selected client does not exist in this workspace.",404);
      const result = await db.transaction(async tx => {
        const [counter] = await tx.insert(invoiceCounters).values({workspaceId:workspace.id,nextNumber:1})
          .onConflictDoUpdate({target:invoiceCounters.workspaceId,set:{nextNumber:sql`${invoiceCounters.nextNumber} + 1`}})
          .returning({nextNumber:invoiceCounters.nextNumber});
        const number = "INV-" + String(counter.nextNumber).padStart(4,"0");
        const [created] = await tx.insert(invoices).values({workspaceId:workspace.id,clientId:client.id,number,issueDate:today(),dueDate:input.dueDate,description:input.description,quantity:input.quantity,unitPriceMinor:input.unitPriceMinor,currency:input.currency,status:"Draft"}).returning();
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.created",entityType:"invoice",entityId:created.id,metadata:{number,currency:input.currency}});
        return created;
      });
      void result;
    }

    if (input.action === "create-expense") {
      const [created] = await db.insert(expenses).values({workspaceId:workspace.id,vendor:input.vendor,category:input.category,date:input.date,amountMinor:input.amountMinor,currency:input.currency,notes:input.notes}).returning();
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"expense.created",entityType:"expense",entityId:created.id,metadata:{amountMinor:created.amountMinor,currency:created.currency}});
    }

    if (input.action === "create-payment") {
      await db.transaction(async tx => {
        const [invoice] = await tx.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).for("update").limit(1);
        if (!invoice || invoice.status === "Draft") throw new Error("Choose an issued invoice in this workspace.");
        if (input.currency !== invoice.currency) throw new Error("Payment currency must match the invoice currency.");
        const existing = await tx.select({amount:sql<string>`coalesce(sum(${payments.amountMinor}),0)::text`}).from(payments).where(and(eq(payments.invoiceId,invoice.id),eq(payments.workspaceId,workspace.id)));
        const paid = Number(existing[0]?.amount ?? "0");
        if (!Number.isSafeInteger(paid)) throw new Error("The existing payment total exceeds the supported amount.");
        const balance = outstandingBalanceMinor(invoice.quantity * invoice.unitPriceMinor, [paid]);
        if (input.amountMinor > balance) throw new Error("Payment cannot exceed the outstanding invoice balance.");
        const nextStatus = deriveInvoiceStatus(invoice.quantity * invoice.unitPriceMinor, paid + input.amountMinor, invoice.dueDate, today());
        const [payment] = await tx.insert(payments).values({workspaceId:workspace.id,invoiceId:invoice.id,clientId:invoice.clientId,date:input.date,amountMinor:input.amountMinor,currency:input.currency,method:input.method,reference:input.reference,notes:input.notes}).returning();
        await tx.update(invoices).set({status:nextStatus,updatedAt:new Date()}).where(and(eq(invoices.id,invoice.id),eq(invoices.workspaceId,workspace.id)));
        await tx.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"payment.recorded",entityType:"payment",entityId:payment.id,metadata:{invoiceId:invoice.id,amountMinor:input.amountMinor,currency:input.currency}});
      });
    }

    if (input.action === "send-invoice") {
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).limit(1);
      if (!invoice) return fail("Invoice not found.",404);
      if (invoice.status !== "Draft") return fail("Only draft invoices can be issued.",409);
      const status = invoice.dueDate < today() ? "Overdue" : "Sent";
      await db.update(invoices).set({status,updatedAt:new Date()}).where(and(eq(invoices.id,invoice.id),eq(invoices.workspaceId,workspace.id)));
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.issued",entityType:"invoice",entityId:invoice.id,metadata:{number:invoice.number}});
    }

    if (input.action === "delete-draft-invoice") {
      const [invoice] = await db.select().from(invoices).where(and(eq(invoices.id,input.invoiceId),eq(invoices.workspaceId,workspace.id))).limit(1);
      if (!invoice) return fail("Invoice not found.",404);
      if (invoice.status !== "Draft") return fail("Issued invoices are retained as financial records.",409);
      await db.delete(invoices).where(and(eq(invoices.id,invoice.id),eq(invoices.workspaceId,workspace.id)));
      await db.insert(auditEvents).values({workspaceId:workspace.id,actorUserId:user.id,action:"invoice.draft_deleted",entityType:"invoice",entityId:invoice.id,metadata:{number:invoice.number}});
    }

    return NextResponse.json({ ok:true, workspace:await loadWorkspace(workspace.id) }, { headers: { "Cache-Control":"private, no-store" } });
  } catch (error) {
    const message = error instanceof Error ? error.message : "The change could not be saved.";
    if (/Choose an issued invoice|currency must match|cannot exceed|exceeds the supported/i.test(message)) return fail(message,409);
    console.error("workspace.mutation",error);
    return fail(message === "The change could not be saved." ? message : "The change could not be saved. Please try again.",500);
  }
}
