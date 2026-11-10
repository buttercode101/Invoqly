import "server-only";
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";
import * as schema from "./schema";

const connectionString = process.env.DATABASE_URL;
if (!connectionString) throw new Error("DATABASE_URL is required.");

const globalForDb = globalThis as typeof globalThis & { invoqlyPool?: Pool };
const pool = globalForDb.invoqlyPool ?? new Pool({ connectionString, max: 5, idleTimeoutMillis: 10_000, connectionTimeoutMillis: 10_000 });
if (process.env.NODE_ENV !== "production") globalForDb.invoqlyPool = pool;

export const db = drizzle(pool, { schema });
export { schema };
