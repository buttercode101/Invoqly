import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getDatabaseUrl, usesHyperdrive } from "@/lib/db/connection";

function createDatabase() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new Error("A database connection is required.");

  const client = postgres(connectionString, {
    // Hyperdrive pools upstream connections, so one short-lived client per
    // Worker request is inexpensive and avoids sharing request-bound sockets.
    max: 5,
    idle_timeout: 0,
    connect_timeout: 10,
    fetch_types: false,
    // Hyperdrive requires prepared statements for its prepared-statement cache.
    // Keep them disabled for the existing Neon/Node pooled connection.
    prepare: usesHyperdrive,
  });

  return { db: drizzle(client, { schema }), client };
}

export type Database = ReturnType<typeof createDatabase>["db"];

export async function withDb<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const connection = createDatabase();
  try {
    return await operation(connection.db);
  } finally {
    // Do not use timeout: 0 here: it aborts pending I/O immediately. Wait for
    // the request's work to settle and the request-owned socket to close.
    await connection.client.end();
  }
}

export { schema };
