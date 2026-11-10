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

Latest full verification: [GitHub Actions run 42786649543](https://github.com/buttercode101/Invoqly/actions/runs/42786649543), successful on candidate commit `c78a67e2216baad3e240f877089ac6a13631dffa`.

The same six Playwright acceptance tests passed against both the preserved Next.js production runtime and the built vinext production preview running locally through Cloudflare's workerd integration. Coverage includes client creation, invoice creation, sent status, partial payment, overpayment rejection, full settlement, payment persistence after reload, legacy storage migration and responsive widths at 320, 375, 768 and 1120 pixels.

The first attempt used vinext's development server and failed because React's development runtime requested `eval()`, which is not supported in workerd. The test harness was corrected to run the built production preview instead; the production-runtime suite then passed. Development-mode failure is not being presented as a production-runtime failure.

This is local workerd production-preview evidence, not a remote Cloudflare Worker deployment. It does not prove database, authentication, object storage, email or payment-provider integrations.

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

## South Africa data-region check

A second provider check found no South African primary region in the current Supabase region list either. Supabase's listed African-market options therefore do not solve local data residency. AWS does offer RDS in Cape Town (`af-south-1`), but this is a different, separately costed infrastructure choice and is not provisioned. For the initial release, choose a managed PostgreSQL region only after comparing South African request latency, monthly cost, operational burden and any customer data-residency requirements. Do not claim South African data residency merely because the product is South Africa-first.

References:
- [Supabase available regions](https://supabase.com/docs/guides/platform/regions)
- [AWS RDS regions](https://docs.aws.amazon.com/AmazonRDS/latest/UserGuide/Concepts.RegionsAndAvailabilityZones.html)
- [Cloudflare Hyperdrive](https://developers.cloudflare.com/hyperdrive/)
