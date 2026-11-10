import "server-only";
import postgres from "postgres";
import { drizzle } from "drizzle-orm/postgres-js";
import { getCloudflareContext } from "@opennextjs/cloudflare";
import * as schema from "./schema";

type HyperdriveBinding = { connectionString: string };

const globalForDb = globalThis as typeof globalThis & {
  invoqlySql?: ReturnType<typeof postgres>;
  invoqlyConnectionString?: string;
};

export function getDb() {
  const directConnectionString = process.env.DATABASE_URL;
  const hyperdrive = directConnectionString
    ? undefined
    : (getCloudflareContext().env as unknown as { HYPERDRIVE?: HyperdriveBinding }).HYPERDRIVE;
  const connectionString = directConnectionString || hyperdrive?.connectionString;
  if (!connectionString) throw new Error("DATABASE_URL or the Cloudflare HYPERDRIVE binding is required.");

  if (!globalForDb.invoqlySql || globalForDb.invoqlyConnectionString !== connectionString) {
    globalForDb.invoqlySql?.end({ timeout: 1 }).catch(() => undefined);
    globalForDb.invoqlySql = postgres(connectionString, {
      max: 5,
      idle_timeout: 20,
      connect_timeout: 10,
      fetch_types: false,
      ...(directConnectionString
        ? { prepare: false }
        : { prepare: true, connection: { application_name: "Invoqly" } }),
    });
    globalForDb.invoqlyConnectionString = connectionString;
  }

  return drizzle(globalForDb.invoqlySql, { schema });
}

export { schema };
