import { readFile } from "node:fs/promises";
import { Pool } from "@neondatabase/serverless";

const connectionString=process.env.DATABASE_URL;
if(!connectionString) throw new Error("DATABASE_URL is required.");
const pool=new Pool({connectionString,max:1});
try {
  await pool.query(`CREATE TABLE IF NOT EXISTS "_invoqly_migrations" ("id" text PRIMARY KEY,"applied_at" timestamptz NOT NULL DEFAULT now())`);
  const existing=await pool.query('SELECT "id" FROM "_invoqly_migrations" WHERE "id"=$1',['0001_invoqly_core']);
  if(existing.rows.length) {
    process.stdout.write("Migration 0001_invoqly_core already applied.\n");
  } else {
    const source=await readFile(new URL("../drizzle/0001_invoqly_core.sql",import.meta.url),"utf8");
    const statements=source.split(";").map(s=>s.trim()).filter(Boolean);
    await pool.query("BEGIN");
    try {
      for(const statement of statements) await pool.query(statement);
      await pool.query('INSERT INTO "_invoqly_migrations" ("id") VALUES ($1)',['0001_invoqly_core']);
      await pool.query("COMMIT");
      process.stdout.write("Applied migration 0001_invoqly_core.\n");
    } catch(error) {
      await pool.query("ROLLBACK");
      throw error;
    }
  }
} finally {
  await pool.end();
}
