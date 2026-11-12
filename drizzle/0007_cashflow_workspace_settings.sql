ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "opening_cash_balance_minor" bigint;
ALTER TABLE "workspaces" ADD COLUMN IF NOT EXISTS "cash_reserve_minor" bigint NOT NULL DEFAULT 0;
