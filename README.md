# Invoqly

**Business, in good order.**

A global business finance workspace for independent professionals and small businesses.

## Implemented in the current preview
- Responsive workspace dashboard with live calculations from the current workspace.
- Client creation and local persistence.
- Invoice creation with draft, sent and paid status transitions.
- Printable invoice documents (browser print / Save as PDF).
- Expense capture and categories.
- Basic reporting and JSON workspace backup.
- Currency-aware amount entry stored as integer minor units.
- South Africa-first defaults with multiple selectable currencies.

## Important limitations
This is an early functional preview, not a production-ready financial application. Records currently persist in the current browser using local storage. There is no cloud database, authentication, multi-device sync, email delivery, payment processing, tax calculation or jurisdiction-specific invoice compliance yet. Do not enter real confidential customer or financial data.

## Development
Requires Node.js 22. Run `npm install`, then `npm run dev`.

## Quality checks
`npm audit --audit-level=high`, `npm run typecheck`, `npm test`, `npm run build`, and `npm run test:e2e`. Install Chromium for local browser tests with `npx playwright install chromium`.

See `docs/PRODUCT_BLUEPRINT.md` and `docs/ARCHITECTURE.md`.
