CREATE TABLE IF NOT EXISTS "user" (
  "id" text PRIMARY KEY,
  "name" text NOT NULL,
  "email" text NOT NULL UNIQUE,
  "emailVerified" boolean NOT NULL DEFAULT false,
  "image" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "session" (
  "id" text PRIMARY KEY,
  "expiresAt" timestamp NOT NULL,
  "token" text NOT NULL UNIQUE,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL,
  "ipAddress" text,
  "userAgent" text,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE
);
CREATE INDEX IF NOT EXISTS "session_userId_idx" ON "session"("userId");
CREATE TABLE IF NOT EXISTS "account" (
  "id" text PRIMARY KEY,
  "accountId" text NOT NULL,
  "providerId" text NOT NULL,
  "userId" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "accessToken" text,
  "refreshToken" text,
  "idToken" text,
  "accessTokenExpiresAt" timestamp,
  "refreshTokenExpiresAt" timestamp,
  "scope" text,
  "password" text,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL
);
CREATE INDEX IF NOT EXISTS "account_userId_idx" ON "account"("userId");
CREATE TABLE IF NOT EXISTS "verification" (
  "id" text PRIMARY KEY,
  "identifier" text NOT NULL,
  "value" text NOT NULL,
  "expiresAt" timestamp NOT NULL,
  "createdAt" timestamp NOT NULL DEFAULT now(),
  "updatedAt" timestamp NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "verification_identifier_idx" ON "verification"("identifier");
CREATE TABLE IF NOT EXISTS "workspaces" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "owner_user_id" text NOT NULL UNIQUE REFERENCES "user"("id") ON DELETE CASCADE,
  "business_name" varchar(120) NOT NULL DEFAULT 'Your business',
  "default_currency" char(3) NOT NULL DEFAULT 'ZAR',
  "locale" varchar(20) NOT NULL DEFAULT 'en-ZA',
  "country_code" char(2) NOT NULL DEFAULT 'ZA',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now()
);
CREATE TABLE IF NOT EXISTS "workspace_members" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "user_id" text NOT NULL REFERENCES "user"("id") ON DELETE CASCADE,
  "role" varchar(20) NOT NULL DEFAULT 'owner' CHECK ("role" IN ('owner','admin','member','viewer')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workspace_id","user_id")
);
CREATE INDEX IF NOT EXISTS "workspace_members_user_idx" ON "workspace_members"("user_id");
CREATE TABLE IF NOT EXISTS "clients" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "name" varchar(120) NOT NULL,
  "email" varchar(254) NOT NULL,
  "company" varchar(120) NOT NULL DEFAULT '',
  "currency" char(3) NOT NULL,
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("id","workspace_id")
);
CREATE INDEX IF NOT EXISTS "clients_workspace_created_idx" ON "clients"("workspace_id","created_at" DESC);
CREATE TABLE IF NOT EXISTS "invoices" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "client_id" uuid NOT NULL,
  "number" varchar(40) NOT NULL,
  "issue_date" date NOT NULL,
  "due_date" date NOT NULL,
  "description" varchar(500) NOT NULL,
  "quantity" numeric(12,3) NOT NULL CHECK ("quantity" > 0),
  "unit_price_minor" bigint NOT NULL CHECK ("unit_price_minor" >= 0),
  "currency" char(3) NOT NULL,
  "status" varchar(24) NOT NULL DEFAULT 'Draft' CHECK ("status" IN ('Draft','Sent','Partially paid','Paid','Overdue')),
  "created_at" timestamptz NOT NULL DEFAULT now(),
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  UNIQUE ("workspace_id","number"),
  UNIQUE ("id","workspace_id"),
  FOREIGN KEY ("client_id","workspace_id") REFERENCES "clients"("id","workspace_id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "invoices_workspace_status_due_idx" ON "invoices"("workspace_id","status","due_date");
CREATE INDEX IF NOT EXISTS "invoices_workspace_created_idx" ON "invoices"("workspace_id","created_at" DESC);
CREATE TABLE IF NOT EXISTS "invoice_counters" (
  "workspace_id" uuid PRIMARY KEY REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "next_number" bigint NOT NULL DEFAULT 0
);
CREATE TABLE IF NOT EXISTS "payments" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "invoice_id" uuid NOT NULL,
  "client_id" uuid NOT NULL,
  "date" date NOT NULL,
  "amount_minor" bigint NOT NULL CHECK ("amount_minor" > 0),
  "currency" char(3) NOT NULL,
  "method" varchar(40) NOT NULL,
  "reference" varchar(100) NOT NULL DEFAULT '',
  "notes" varchar(500) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now(),
  FOREIGN KEY ("invoice_id","workspace_id") REFERENCES "invoices"("id","workspace_id") ON DELETE RESTRICT,
  FOREIGN KEY ("client_id","workspace_id") REFERENCES "clients"("id","workspace_id") ON DELETE RESTRICT
);
CREATE INDEX IF NOT EXISTS "payments_workspace_date_idx" ON "payments"("workspace_id","date" DESC);
CREATE INDEX IF NOT EXISTS "payments_invoice_idx" ON "payments"("invoice_id");
CREATE TABLE IF NOT EXISTS "expenses" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "vendor" varchar(160) NOT NULL,
  "category" varchar(80) NOT NULL,
  "date" date NOT NULL,
  "amount_minor" bigint NOT NULL CHECK ("amount_minor" > 0),
  "currency" char(3) NOT NULL,
  "notes" varchar(500) NOT NULL DEFAULT '',
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "expenses_workspace_date_idx" ON "expenses"("workspace_id","date" DESC);
CREATE TABLE IF NOT EXISTS "audit_events" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "actor_user_id" text NOT NULL REFERENCES "user"("id") ON DELETE RESTRICT,
  "action" varchar(80) NOT NULL,
  "entity_type" varchar(40) NOT NULL,
  "entity_id" uuid,
  "metadata" jsonb NOT NULL DEFAULT '{}'::jsonb,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "audit_workspace_created_idx" ON "audit_events"("workspace_id","created_at" DESC);
