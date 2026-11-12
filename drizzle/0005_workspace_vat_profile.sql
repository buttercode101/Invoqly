ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "vat_registered" boolean NOT NULL DEFAULT false;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "vat_number" varchar(10) NOT NULL DEFAULT '';
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "business_address" varchar(250) NOT NULL DEFAULT '';
