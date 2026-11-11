ALTER TABLE "clients" ADD COLUMN IF NOT EXISTS "is_one_off" boolean NOT NULL DEFAULT false;
