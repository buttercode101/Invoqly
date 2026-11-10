import { env } from "cloudflare:workers";

export function getDatabaseUrl(): string | undefined {
  return env.HYPERDRIVE?.connectionString;
}
