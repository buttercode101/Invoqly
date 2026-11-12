# Invoqly

**Business, in good order.**

Invoqly is a business finance workspace for independent professionals and small businesses. Core invoicing and record-keeping are designed to be usable without a subscription or mandatory account.

## Start without an account

Open the public site and choose **Try Invoqly free — no account**. Guest mode currently supports:

- Create invoices immediately by typing customer details manually; saving a contact is optional.
- Add multiple priced lines to invoices and quotations, with deterministic totals and PDF output.
- Save reusable contacts when you choose.
- Create quotations, print or save them as PDF, track sent/accepted/declined status, and convert accepted quotes into invoices.
- Draft and issue invoices.
- Mark invoices paid.
- Record business expenses manually, with an optional compressed receipt photo captured from a mobile camera or selected from the device.
- View invoice, outstanding and expense totals.
- Print invoices and quotations or save them as PDF through the browser print dialog.
- Export a JSON backup.

Guest records are stored locally in the current browser on the current device. They are not uploaded to Invoqly's cloud. The installable web app caches its guest workspace shell so previously opened guest work can be reopened offline; guest changes remain local to that device. Browser storage can be cleared by the user or browser, so export a backup for important records.

## Create an account when you need cloud features

An account unlocks a private PostgreSQL-backed workspace, server-side persistence, multi-device access, synced quotations and optional compressed receipt-photo attachments on cloud expenses. One-off invoice customers remain out of the saved contacts list unless the user explicitly chooses to save them. If a guest workspace is present in the same browser, the signed-in user can import it directly; a JSON backup from another device can also be uploaded in workspace settings. Import keeps existing cloud records, records paid guest invoices in the payment ledger and uses a stable import ID to avoid duplicates if the request is retried. File imports use separate temporary storage so they never overwrite a different local guest workspace.

Creating an account is optional for guest core functionality. No subscription or payment details are required to use the free core tools.

## Current product boundaries

- Invoqly records payments manually; it does not process card or bank payments.
- Email delivery and automated reminders are not yet enabled. The AI co-pilot can prepare reminder drafts, but it does not send or schedule them.
- The optional AI co-pilot is available in authenticated workspaces after explicit privacy consent. It can prepare multi-line invoice/quote drafts using exact historical line prices or user-stated prices, rank overdue receivables, draft reminders and model supported cash-flow scenarios. AI never performs financial arithmetic or writes records without approval.
- The deterministic South African VAT calculation and tax-invoice validation core exists, but it is not yet integrated into invoice/expense records. VAT201 is not filed or submitted; any working summary requires practitioner review.
- Cash-flow scenarios currently use recorded invoices and future-dated expenses. There are no connected bank feeds, payment gateways, opening cash balance or verified safe-to-spend amount yet.
- Client payment-behaviour profiles now derive transparent on-time rates, average days to pay and preferred methods from recorded invoices/payments; they are not credit scores. Full communication timelines, receipt OCR, voice/photo document extraction and automated follow-ups are not yet implemented.
- Guest data is device-local until imported. Cloud data requires authentication and is tenant-scoped. The signed-in workspace currently requires a network connection; there is no offline cloud-write queue or background sync.
- The signed-in product currently exposes one active workspace per user; workspace membership primitives exist, but a multi-workspace create/switch UI and end-to-end tenant-switching workflow are not yet complete.
- Cloud expense receipt photos are stored as compressed image data with the expense record (up to 480 KB per image); manual expense entry remains available without a photo. Receipt OCR and automatic expense extraction are not implemented.
- The PWA shell and guest route support offline reopening after an initial online visit. No Android TWA/Play Store wrapper is included in this repository yet.
- The Cloudflare preview has passed the release-candidate verification suite. Production deployment remains gated on a dedicated production Hyperdrive configuration and the production migration/release workflow. Invoqly is not a tax-compliance service; do not rely on it as a substitute for professional tax or accounting advice.

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
