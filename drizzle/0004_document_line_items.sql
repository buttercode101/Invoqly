ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "line_items" jsonb NOT NULL DEFAULT '[]'::jsonb;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "line_items" jsonb NOT NULL DEFAULT '[]'::jsonb;
