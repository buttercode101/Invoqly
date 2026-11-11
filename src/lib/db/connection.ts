export function getDatabaseUrl(): string | undefined {
  return process.env.DATABASE_URL;
}

export const usesHyperdrive = false;
