# Invoqly production release runbook

## Current release candidate

- Application repository: `buttercode101/Invoqly`
- Candidate merged to `main` on 2026-11-11 at `8582101712d06b7018ec3906d14ad3766756907d`
- Cloudflare preview: `https://invoqly-preview.buttercoder-dev.workers.dev`
- Production Worker target: `invoqly-production`
- Production Worker URL: `https://invoqly-production.buttercoder-dev.workers.dev`
- Production Neon project: `invoqly-production`
- Production Neon branch: `br-restless-paper-bafnpmyg`
- Production database: `invoqly`

## Production Hyperdrive (one-time dashboard setup)

A least-privilege PostgreSQL role has been created on the production branch:

- Role: `invoqly_worker_prod`
- Access: read/write, scoped to database `invoqly` and schema `public`
- Direct origin host: `ep-late-mode-baw0f3w9.c-8.eu-central-1.aws.neon.tech`
- Port: `5432`
- Database: `invoqly`
- TLS: required
- Channel binding: do not require it
- Hyperdrive query caching: disabled
- Origin connection limit: `5`

In the Cloudflare dashboard, create a Hyperdrive configuration named `invoqly-production` using those values and the password for `invoqly_worker_prod`. Do not use the preview Hyperdrive ID or the preview Neon branch. Do not paste credentials into GitHub or commit them.

After Cloudflare creates the configuration, copy its ID into GitHub:
Repository → Settings → Secrets and variables → Actions → Variables:
- Name: `CLOUDFLARE_PRODUCTION_HYPERDRIVE_ID`
- Value: the new production Hyperdrive ID

The GitHub Actions secrets `CLOUDFLARE_API_TOKEN`, `BETTER_AUTH_SECRET`, and `INVOQLY_PRODUCTION_MIGRATION_DATABASE_URL` are required by the production workflow. The migration secret must point to the production Neon `main` branch and database `invoqly`; never use the preview branch or a pooled application connection. The migration step applies only the checked-in additive migrations before Worker deployment.

## Deployment

The workflow `.github/workflows/cloudflare-deploy-production.yml` is intentionally gated:
- It deploys only from `main` (or manual dispatch from `main`).
- It requires the dedicated production Hyperdrive ID.
- It builds and tests before deployment.
- It deploys to a separate Worker named `invoqly-production`.
- It verifies both Worker health and the production database.

It never points production traffic at the preview database.

## Email and account recovery

Production registration currently runs with email verification disabled so account creation does not depend on an unconfigured email provider. Password reset email delivery is not release-ready until a verified transactional email sender is configured with Resend. Add the API key as a Cloudflare Worker secret and configure the sender before enabling email verification or advertising password recovery.

## Domain cutover

The current Cloudflare account connection does not expose a zone for `invoqly.xyz`, and the canonical domain is still associated with the existing Vercel setup. The production Worker can be validated on its `workers.dev` URL first. A custom-domain cutover requires authorized DNS/domain access and must not be attempted by changing unrelated records.

## Pricing promise

Core invoicing, customer records, expenses, payments and basic reporting remain free without a recurring subscription. Optional services must be clearly priced per use before any charge is initiated. Do not add a subscription paywall to core workflows.
