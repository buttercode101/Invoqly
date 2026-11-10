# Architecture decision record: Cloudflare runtime evaluation

- Status: evaluated locally; production deployment pending
- Date: 2026-11-10
- Scope: isolated branch `experiment/cloudflare-vinext-check`

## Context

Invoqly's initial foundation was built with Next.js App Router and deployed as a Vercel preview. Cloudflare is also connected to the project account, so its current recommended Next.js-on-Workers path needed to be tested before choosing a long-term hosting platform.

## Evidence gathered

The isolated candidate uses Cloudflare's documented vinext setup alongside the preserved Next.js app. GitHub Actions successfully completed all of the following on the candidate branch:

1. `npm ci` from the committed lockfile
2. `npx vinext check`
3. Non-destructive `vinext init --platform=cloudflare`
4. Targeted dependency updates and `npm audit --audit-level=moderate`
5. TypeScript check
6. vinext production build
7. Original Next.js production build
8. Unit tests
9. Existing Playwright workspace tests against the Next.js production runtime
10. The same browser workflow against vinext's local Cloudflare/workerd runtime

Latest full verification: [GitHub Actions run 42781669302](https://github.com/buttercode101/Invoqly/actions/runs/42781669302), successful on candidate commit `137aa455602419477667acb210e25569d423f4db`.

This verifies local build and browser behaviour in workerd. It is not a deployed Cloudflare Worker test and does not prove database, authentication, object storage, email or payment integrations.

## Decision

Keep the Cloudflare candidate isolated until a remote preview deployment is verified. Do not replace the current Vercel preview or merge the candidate into the foundation branch based only on local workerd tests.

The candidate runtime is Cloudflare Workers with vinext. The original Next.js runtime remains intact and independently buildable.

## Data architecture constraints

- Financial records require PostgreSQL as the source of truth; do not choose D1 as the primary financial ledger without a separate latency, region and feature assessment.
- Cloudflare Hyperdrive is a connection-pooling bridge to an existing PostgreSQL database, not a database product or data replica.
- Neon currently exposes Frankfurt (AWS eu-central-1) as the closest listed region to South Africa; no South African Neon region appeared in the connected account's available region list.
- Existing Neon projects belong to other applications and must not be reused for Invoqly.
- No Invoqly database has been created. A dedicated staging database and a separate production database must be provisioned only after region, budget and access requirements are confirmed.
- R2 is a candidate for private invoice PDFs and attachments, but no bucket has been created.
- Consumer authentication must be evaluated separately. Cloudflare Access is not a substitute for customer sign-in on a public SaaS product.

## Remaining release gates

1. Deploy a non-production Worker preview from the exact candidate commit.
2. Run external smoke tests against the deployed URL and verify logs/errors.
3. Provision an isolated staging PostgreSQL database and validate Hyperdrive connectivity.
4. Implement server-side identity, workspace authorization and tenant isolation before storing real customer data.
5. Add private object storage and test signed access.
6. Compare actual runtime performance, limits and expected cost with the Vercel preview.
7. Make a documented hosting decision; preserve a rollback path.

## Guardrails

No DNS changes, custom-domain attachment, production deployment, production database, production secrets or changes to the InvoiceFlow repository are part of this experiment.
