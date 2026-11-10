import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getDatabaseUrl } from "@/lib/db/connection";

function createDatabase() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new Error("A database connection is required.");
  const sql = postgres(connectionString, {
    max: 5,
    idle_timeout: 20,
    connect_timeout: 10,
    prepare: false,
  });
  return drizzle(sql, { schema });
}

type Database = ReturnType<typeof createDatabase>;
const globalForDb = globalThis as typeof globalThis & { invoqlyDb?: Database };

export function getDb(): Database {
  // Construct the Postgres client lazily inside the first request handler.
  // Cloudflare Workers prohibit timers, sockets and other async I/O at module scope.
  return globalForDb.invoqlyDb ?? (globalForDb.invoqlyDb = createDatabase());
}

export { schema };
