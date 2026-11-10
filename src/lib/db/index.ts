import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import * as schema from "./schema";
import { getDatabaseUrl } from "@/lib/db/connection";

function createDatabase() {
  const connectionString = getDatabaseUrl();
  if (!connectionString) throw new Error("A database connection is required.");
  const client = postgres(connectionString, {
    max: 1,
    idle_timeout: 0,
    connect_timeout: 10,
    prepare: false,
  });
  return { db: drizzle(client, { schema }), client };
}

export type Database = ReturnType<typeof createDatabase>["db"];

export async function withDb<T>(operation: (db: Database) => Promise<T>): Promise<T> {
  const connection = createDatabase();
  try {
    return await operation(connection.db);
  } finally {
    // Hyperdrive pools the upstream connection. Do not share postgres.js I/O
    // streams between Worker requests; each request owns and closes its client.
    await connection.client.end({ timeout: 0 });
  }
}

export { schema };
