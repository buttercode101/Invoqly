# Cloudflare production migration

- Status: integration candidate; remote deployment and acceptance pending
- Target: Cloudflare Workers with vinext
- Source baseline: feat/invoqly-production

## Architecture

- Preserve the Next.js application and its independent production build.
- Run the Cloudflare application through vinext and the Cloudflare Vite plugin.
- Keep PostgreSQL as the source of truth for authentication and financial records.
- Connect Workers to the isolated Invoqly preview database through Cloudflare Hyperdrive.
- Keep the Node.js database adapter for the preserved Next.js runtime and use a separate Cloudflare binding adapter in the Workers build.
- Disable Hyperdrive query caching for financial reads to preserve read-after-write correctness.

## Verification requirements

The candidate must pass the existing PostgreSQL migration, TypeScript, unit, Next.js build, vinext build, Next.js browser suite, and Cloudflare workerd browser suite. The Cloudflare suite must use the same authenticated production application and isolated CI PostgreSQL schema, not the earlier browser-local prototype.

A passing local workerd suite is not a remote deployment. Production traffic and DNS must remain unchanged until a remotely deployed preview passes health, authentication, tenant-isolation, financial mutation, persistence, and responsive browser checks.

## Operational boundaries

- The preview Worker must use the Invoqly preview database branch only.
- Never attach the production domain to a preview Worker.
- Never reuse another application's database or Cloudflare resources.
- Never commit credentials. Hyperdrive credentials are configured in Cloudflare and referenced by ID in the Worker configuration.
- Preserve the existing Vercel deployment as a rollback target until Cloudflare production acceptance passes.

## Neon preview endpoint for Hyperdrive

The isolated preview branch is in Neon project `polished-boat-47264206`, branch `br-snowy-moon-ban4ss6c`, database `invoqly`, role `invoqly_owner`. Use the direct read/write host `ep-bold-mode-bajcikj0.c-8.eu-central-1.aws.neon.tech` on port `5432`, not the pooled hostname. Require TLS. Do not require PostgreSQL channel binding: Cloudflare Workers TCP sockets do not expose the server certificate needed for channel binding.

Hyperdrive query caching must be disabled. Never put the Neon password or a full connection URI in this repository; enter it directly into the Cloudflare Hyperdrive configuration UI.
