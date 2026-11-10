import "server-only";
import { and, asc, desc, eq, inArray, lt } from "drizzle-orm";
import { headers } from "next/headers";
import { getAuth } from "@/lib/auth";
import { getDb } from "@/lib/db";
import { auditEvents, clients, expenses, invoices, payments, workspaceMembers, workspaces } from "@/lib/db/schema";

export async function getCurrentUser() {
  const session = await getAuth().api.getSession({ headers: await headers() });
  return session?.user ?? null;
}

export async function getOrCreateWorkspace(userId: string) {
  const db = getDb();
  const [membership] = await db.select({ workspace: workspaces }).from(workspaceMembers)
    .innerJoin(workspaces, eq(workspaceMembers.workspaceId, workspaces.id))
    .where(eq(workspaceMembers.userId, userId)).orderBy(asc(workspaceMembers.createdAt)).limit(1);
  if (membership?.workspace) return membership.workspace;

  const [created] = await db.insert(workspaces).values({ ownerUserId: userId }).onConflictDoNothing().returning();
  const workspace = created ?? (await db.select().from(workspaces).where(eq(workspaces.ownerUserId, userId)).limit(1))[0];
  if (!workspace) throw new Error("Workspace could not be created.");
  await db.insert(workspaceMembers).values({ workspaceId: workspace.id, userId, role: "owner" }).onConflictDoNothing();
  return workspace;
}

export async function writeAudit(workspaceId: string, actorUserId: string, action: string, entityType: string, entityId: string | null, metadata: Record<string, unknown> = {}) {
  const db = getDb();
  await db.insert(auditEvents).values({ workspaceId, actorUserId, action, entityType, entityId, metadata });
}

export async function loadWorkspace(workspaceId: string) {
  const db = getDb();
  const today = new Date().toISOString().slice(0, 10);
  await db.update(invoices).set({ status: "Overdue", updatedAt: new Date() })
    .where(and(eq(invoices.workspaceId, workspaceId), lt(invoices.dueDate, today), inArray(invoices.status, ["Sent", "Partially paid"])));
  const [clientRows, invoiceRows, paymentRows, expenseRows, workspaceRows] = await Promise.all([
    db.select().from(clients).where(eq(clients.workspaceId, workspaceId)).orderBy(desc(clients.createdAt)),
    db.select().from(invoices).where(eq(invoices.workspaceId, workspaceId)).orderBy(desc(invoices.createdAt)),
    db.select().from(payments).where(eq(payments.workspaceId, workspaceId)).orderBy(desc(payments.date), desc(payments.createdAt)),
    db.select().from(expenses).where(eq(expenses.workspaceId, workspaceId)).orderBy(desc(expenses.date), desc(expenses.createdAt)),
    db.select().from(workspaces).where(eq(workspaces.id, workspaceId)).limit(1),
  ]);
  const workspace = workspaceRows[0];
  return {
    businessName: workspace?.businessName ?? "Your business",
    currency: workspace?.defaultCurrency ?? "ZAR",
    locale: workspace?.locale ?? "en-ZA",
    clients: clientRows.map(c => ({ id:c.id, name:c.name, email:c.email, company:c.company, currency:c.currency, createdAt:c.createdAt.toISOString() })),
    invoices: invoiceRows.map(i => ({ id:i.id, clientId:i.clientId, number:i.number, issueDate:i.issueDate, dueDate:i.dueDate, description:i.description, quantity:i.quantity, unitPriceMinor:i.unitPriceMinor, currency:i.currency, status:i.status, createdAt:i.createdAt.toISOString() })),
    payments: paymentRows.map(p => ({ id:p.id, invoiceId:p.invoiceId, clientId:p.clientId, date:p.date, amountMinor:p.amountMinor, currency:p.currency, method:p.method, reference:p.reference, notes:p.notes, createdAt:p.createdAt.toISOString() })),
    expenses: expenseRows.map(e => ({ id:e.id, vendor:e.vendor, category:e.category, date:e.date, amountMinor:e.amountMinor, currency:e.currency, notes:e.notes })),
  };
}
