# Invoqly

**Business, in good order.**

Invoqly is a business finance workspace for independent professionals and small businesses. Core invoicing and record-keeping are designed to be usable without a subscription or mandatory account.

## Start without an account

Open the public site and choose **Try Invoqly free — no account**. Guest mode currently supports:

- Create and manage client records.
- Draft and issue invoices.
- Mark invoices paid.
- Record business expenses.
- View invoice, outstanding and expense totals.
- Print invoices or save them as PDF through the browser print dialog.
- Export a JSON backup.

Guest records are stored locally in the current browser on the current device. They are not uploaded to Invoqly's cloud. Browser storage can be cleared by the user or browser, so export a backup for important records.

## Create an account when you need cloud features

An account unlocks a private PostgreSQL-backed workspace, server-side persistence and multi-device access. If a guest workspace is present in the same browser, the signed-in user can explicitly import its clients, invoices and expenses. Import keeps existing cloud records, records paid guest invoices in the payment ledger and uses a stable import ID to avoid duplicates if the request is retried.

Creating an account is optional for guest core functionality. No subscription or payment details are required to use the free core tools.

## Current product boundaries

- Invoqly records payments manually; it does not process card or bank payments.
- Email delivery and automated reminders are not yet enabled.
- Tax calculations and jurisdiction-specific invoice compliance are not yet implemented.
- Guest data is device-local until imported. Cloud data requires authentication and is tenant-scoped.
- This is a release candidate under verification, not yet an advertised production accounting or tax-compliance service. Do not rely on it as a substitute for professional tax or accounting advice.

## Architecture

- Next.js application with a separate Cloudflare Workers runtime using vinext.
- Cloudflare Worker preview backed by Neon PostgreSQL through Hyperdrive.
- Better Auth email/password sessions for private cloud workspaces.
- Server-side workspace scoping, validation, transactional financial writes and audit events.
- Guest mode runs entirely in the browser and never calls the cloud workspace API until the user explicitly imports.

## Development

Requires Node.js 22.

```bash
npm install
npm run dev
```

## Verification

```bash
npm audit --audit-level=high
npm run typecheck
npm test
npm run build
npm run test:e2e
npm run build:vinext
npm run test:e2e:vinext
```

See [Product blueprint](docs/PRODUCT_BLUEPRINT.md), [Architecture](docs/ARCHITECTURE.md), and [Production release runbook](docs/production-release-runbook.md).
