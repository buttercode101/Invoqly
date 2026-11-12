import { desc } from "drizzle-orm";
import type { DocumentLineItem } from "@/lib/documents";
import { boolean, bigint, char, date, foreignKey, index, jsonb, numeric, pgTable, text, timestamp, unique, uuid, varchar } from "drizzle-orm/pg-core";

export const user = pgTable("user", {
  id: text("id").primaryKey(),
  name: text("name").notNull(),
  email: text("email").notNull().unique(),
  emailVerified: boolean("emailVerified").notNull().default(false),
  image: text("image"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
});

export const session = pgTable("session", {
  id: text("id").primaryKey(),
  expiresAt: timestamp("expiresAt").notNull(),
  token: text("token").notNull().unique(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull(),
  ipAddress: text("ipAddress"),
  userAgent: text("userAgent"),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
}, (t) => [index("session_userId_idx").on(t.userId)]);

export const account = pgTable("account", {
  id: text("id").primaryKey(),
  accountId: text("accountId").notNull(),
  providerId: text("providerId").notNull(),
  userId: text("userId").notNull().references(() => user.id, { onDelete: "cascade" }),
  accessToken: text("accessToken"),
  refreshToken: text("refreshToken"),
  idToken: text("idToken"),
  accessTokenExpiresAt: timestamp("accessTokenExpiresAt"),
  refreshTokenExpiresAt: timestamp("refreshTokenExpiresAt"),
  scope: text("scope"),
  password: text("password"),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull(),
}, (t) => [index("account_userId_idx").on(t.userId)]);

export const verification = pgTable("verification", {
  id: text("id").primaryKey(),
  identifier: text("identifier").notNull(),
  value: text("value").notNull(),
  expiresAt: timestamp("expiresAt").notNull(),
  createdAt: timestamp("createdAt").notNull().defaultNow(),
  updatedAt: timestamp("updatedAt").notNull().defaultNow(),
}, (t) => [index("verification_identifier_idx").on(t.identifier)]);

export const workspaces = pgTable("workspaces", {
  id: uuid("id").defaultRandom().primaryKey(),
  ownerUserId: text("owner_user_id").notNull().unique().references(() => user.id, { onDelete: "cascade" }),
  businessName: varchar("business_name", { length: 120 }).notNull().default("Your business"),
  defaultCurrency: char("default_currency", { length: 3 }).notNull().default("ZAR"),
  locale: varchar("locale", { length: 20 }).notNull().default("en-ZA"),
  countryCode: char("country_code", { length: 2 }).notNull().default("ZA"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
});

export const workspaceMembers = pgTable("workspace_members", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  userId: text("user_id").notNull().references(() => user.id, { onDelete: "cascade" }),
  role: varchar("role", { length: 20 }).notNull().default("owner"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("workspace_members_workspace_user_uq").on(t.workspaceId, t.userId), index("workspace_members_user_idx").on(t.userId)]);

export const clients = pgTable("clients", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  name: varchar("name", { length: 120 }).notNull(),
  email: varchar("email", { length: 254 }).notNull(),
  company: varchar("company", { length: 120 }).notNull().default(""),
  isOneOff: boolean("is_one_off").notNull().default(false),
  currency: char("currency", { length: 3 }).notNull(),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("clients_id_workspace_uq").on(t.id, t.workspaceId), index("clients_workspace_created_idx").on(t.workspaceId, t.createdAt)]);

export const invoices = pgTable("invoices", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  clientId: uuid("client_id").notNull(),
  number: varchar("number", { length: 40 }).notNull(),
  issueDate: date("issue_date", { mode: "string" }).notNull(),
  dueDate: date("due_date", { mode: "string" }).notNull(),
  description: varchar("description", { length: 500 }).notNull(),
  quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(),
  unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  lineItems: jsonb("line_items").$type<DocumentLineItem[]>().notNull().default([]),
  status: varchar("status", { length: 24 }).notNull().default("Draft"),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
  updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [unique("invoices_workspace_number_uq").on(t.workspaceId, t.number), unique("invoices_id_workspace_uq").on(t.id, t.workspaceId), index("invoices_workspace_status_due_idx").on(t.workspaceId, t.status, t.dueDate), index("invoices_workspace_created_idx").on(t.workspaceId, t.createdAt), foreignKey({columns:[t.clientId,t.workspaceId],foreignColumns:[clients.id,clients.workspaceId]}).onDelete("restrict")]);

export const invoiceCounters = pgTable("invoice_counters", {
  workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }),
  nextNumber: bigint("next_number", { mode: "number" }).notNull().default(0),
});

export const payments = pgTable("payments", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  invoiceId: uuid("invoice_id").notNull(),
  clientId: uuid("client_id").notNull(),
  date: date("date", { mode: "string" }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  method: varchar("method", { length: 40 }).notNull(),
  reference: varchar("reference", { length: 100 }).notNull().default(""),
  notes: varchar("notes", { length: 500 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("payments_workspace_date_idx").on(t.workspaceId, t.date), index("payments_invoice_idx").on(t.invoiceId), foreignKey({columns:[t.invoiceId,t.workspaceId],foreignColumns:[invoices.id,invoices.workspaceId]}).onDelete("restrict"), foreignKey({columns:[t.clientId,t.workspaceId],foreignColumns:[clients.id,clients.workspaceId]}).onDelete("restrict")]);

export const expenses = pgTable("expenses", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  vendor: varchar("vendor", { length: 160 }).notNull(),
  category: varchar("category", { length: 80 }).notNull(),
  date: date("date", { mode: "string" }).notNull(),
  amountMinor: bigint("amount_minor", { mode: "number" }).notNull(),
  currency: char("currency", { length: 3 }).notNull(),
  notes: varchar("notes", { length: 500 }).notNull().default(""),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("expenses_workspace_date_idx").on(t.workspaceId, t.date)]);

export const auditEvents = pgTable("audit_events", {
  id: uuid("id").defaultRandom().primaryKey(),
  workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }),
  actorUserId: text("actor_user_id").notNull().references(() => user.id, { onDelete: "restrict" }),
  action: varchar("action", { length: 80 }).notNull(),
  entityType: varchar("entity_type", { length: 40 }).notNull(),
  entityId: uuid("entity_id"),
  metadata: jsonb("metadata").notNull().default({}),
  createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(),
}, (t) => [index("audit_workspace_created_idx").on(t.workspaceId, t.createdAt)]);

export const quoteCounters = pgTable("quote_counters", { workspaceId: uuid("workspace_id").primaryKey().references(() => workspaces.id, { onDelete: "cascade" }), nextNumber: bigint("next_number", { mode: "number" }).notNull().default(0) });

export const quotes = pgTable("quotes", { id: uuid("id").defaultRandom().primaryKey(), workspaceId: uuid("workspace_id").notNull().references(() => workspaces.id, { onDelete: "cascade" }), number: varchar("number", { length: 40 }).notNull(), customerName: varchar("customer_name", { length: 120 }).notNull(), customerEmail: varchar("customer_email", { length: 254 }).notNull().default(""), customerCompany: varchar("customer_company", { length: 120 }).notNull().default(""), issueDate: date("issue_date", { mode: "string" }).notNull(), validUntil: date("valid_until", { mode: "string" }).notNull(), description: varchar("description", { length: 500 }).notNull(), quantity: numeric("quantity", { precision: 12, scale: 3, mode: "number" }).notNull(), unitPriceMinor: bigint("unit_price_minor", { mode: "number" }).notNull(), currency: char("currency", { length: 3 }).notNull(), lineItems: jsonb("line_items").$type<DocumentLineItem[]>().notNull().default([]), status: varchar("status", { length: 24 }).notNull().default("Draft"), convertedInvoiceId: uuid("converted_invoice_id"), createdAt: timestamp("created_at", { withTimezone: true }).notNull().defaultNow(), updatedAt: timestamp("updated_at", { withTimezone: true }).notNull().defaultNow() }, (t) => [unique("quotes_workspace_id_number_key").on(t.workspaceId, t.number), index("quotes_workspace_created_idx").on(t.workspaceId, desc(t.createdAt))]);
