# Invoqly

**Business, in good order.**

A global business finance workspace for independent professionals and small businesses.

## Free guest mode
Visitors can open `/guest` and use core invoicing tools without creating an account. Guest clients, invoices and expenses are saved in the current browser, and a JSON backup can be exported at any time. Guest records are not uploaded to the cloud.

## Account workspace
An account unlocks the private cloud workspace, server-side persistence and multi-device access. Authentication is optional for basic guest use; it is required only for account-backed features.

The guest workspace currently supports client records, invoice drafting/issuing/marking paid, expense capture, dashboard totals and local backup export. It is an early functional slice, not yet a complete accounting or tax-compliance product.

## Important limitations
This is an early functional preview, not a production-ready financial application. Records currently persist in the current browser using local storage. There is no cloud database, authentication, multi-device sync, email delivery, payment processing, tax calculation or jurisdiction-specific invoice compliance yet. Do not enter real confidential customer or financial data.

## Development
Requires Node.js 22. Run `npm install`, then `npm run dev`.

## Quality checks
`npm audit --audit-level=high`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Install Chromium for local browser tests with `npx playwright install chromium`.

See `docs/PRODUCT_BLUEPRINT.md` and `docs/ARCHITECTURE.md`.
