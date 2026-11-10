# Cloudflare migration status

This branch is based on the current authenticated PostgreSQL production foundation, not the older browser-local Cloudflare experiment.

## Runtime candidate

- Next.js 15 App Router on Cloudflare Workers using the maintained OpenNext Cloudflare adapter.
- Wrangler configuration is isolated to the `invoqly-preview` Worker. It does not attach `invoqly.xyz`, alter DNS, or deploy to production.
- PostgreSQL remains the system of record. Cloudflare Hyperdrive is the intended database transport; query-result caching is disabled for financial consistency.

## Verification

The Cloudflare CI job runs the same PostgreSQL migration, typecheck, unit tests and Next.js build as the production foundation, then builds the OpenNext Worker and validates its Wrangler bundle with a dry run.

## Deliberate deployment gate

A Worker must not receive customer traffic until the preview Neon branch is connected through a dedicated Hyperdrive binding, and the application runtime reads that binding correctly. The current app initializes Postgres.js from `DATABASE_URL`; this adapter branch does not silently substitute a direct database URL for Hyperdrive. The Cloudflare preview Hyperdrive configuration and runtime binding are therefore an explicit next integration gate, not a fabricated ID or an unverified deployment.

The existing Vercel production foundation and domain remain untouched while the isolated Worker candidate is verified.
