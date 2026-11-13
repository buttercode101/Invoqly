
ALTER TABLE "workspaces"
  ADD COLUMN IF NOT EXISTS "document_settings" jsonb NOT NULL
  DEFAULT '{"templateId":"modern","accentColor":"#245b49","logoDataUrl":null,"brandName":""}'::jsonb;
ALTER TABLE "invoices" ADD COLUMN IF NOT EXISTS "document_design" jsonb;
ALTER TABLE "quotes" ADD COLUMN IF NOT EXISTS "document_design" jsonb;
CREATE TABLE IF NOT EXISTS "quote_public_links" (
  "id" uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  "workspace_id" uuid NOT NULL REFERENCES "workspaces"("id") ON DELETE CASCADE,
  "quote_id" uuid NOT NULL REFERENCES "quotes"("id") ON DELETE CASCADE,
  "token_hash" varchar(64) NOT NULL UNIQUE,
  "expires_at" timestamptz NOT NULL,
  "revoked_at" timestamptz,
  "decision_status" varchar(16) NOT NULL DEFAULT 'Pending' CHECK ("decision_status" IN ('Pending','Accepted','Declined')),
  "signer_name" varchar(120),
  "signer_email" varchar(254),
  "signature_data_url" text,
  "rejection_reason" varchar(500),
  "decision_at" timestamptz,
  "last_viewed_at" timestamptz,
  "created_at" timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS "quote_public_links_workspace_quote_idx" ON "quote_public_links"("workspace_id","quote_id");
CREATE INDEX IF NOT EXISTS "quote_public_links_expires_idx" ON "quote_public_links"("expires_at");
