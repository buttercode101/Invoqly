import { readFile } from "node:fs/promises";
import postgres from "postgres";

const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error("DATABASE_URL is required.");
const sql=postgres(connectionString,{max:1,prepare:false,connect_timeout:10});
try {
  await sql`CREATE TABLE IF NOT EXISTS "_invoqly_migrations" ("id" text PRIMARY KEY,"applied_at" timestamptz NOT NULL DEFAULT now())`;
  const existing=await sql`SELECT "id" FROM "_invoqly_migrations" WHERE "id"='0001_invoqly_core'`;
  if(existing.length) {
    process.stdout.write("Migration 0001_invoqly_core already applied.\n");
  } else {
    const source=await readFile(new URL("../drizzle/0001_invoqly_core.sql",import.meta.url),"utf8");
    const statements=source.split(";").map(s=>s.trim()).filter(Boolean);
    await sql.begin(async tx=>{
      for(const statement of statements) await tx.unsafe(statement);
      await tx`INSERT INTO "_invoqly_migrations" ("id") VALUES ('0001_invoqly_core')`;
    });
    process.stdout.write("Applied migration 0001_invoqly_core.\n");
  }
} finally {
  await sql.end({timeout:5});
}
