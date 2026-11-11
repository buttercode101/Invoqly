# Invoqly Architecture

## Current application foundation
- Next.js App Router, React and TypeScript.
- A separate Cloudflare Workers runtime built with vinext.
- Neon PostgreSQL for authenticated cloud workspaces, reached from Cloudflare Workers through Hyperdrive.
- Better Auth email/password sessions for account-backed features.
- Drizzle ORM, reviewed SQL migrations and request-scoped database connections.
- Playwright browser acceptance tests against the production Next.js build and the Cloudflare workerd production bundle.
- Responsive CSS and Lucide icons.

## Access modes

### Guest workspace
- Public route: `/guest`.
- Does not initialize authentication or call the cloud workspace API.
- Clients, invoices and expenses are saved in browser local storage on the current device.
- Guests can draft and issue invoices, mark them paid, view totals, print/save invoices as PDF and export a JSON backup.
- Local storage is not a cloud backup and can be removed by browser settings or device loss. The interface must explain this boundary.

### Authenticated cloud workspace
- Account creation is optional and is only needed for cloud-backed capabilities.
- Server-side session validation gates `/api/workspace`.
- All reads and writes are scoped to the user's private workspace.
- Cloud persistence enables use across devices and is independent from the guest local store.

### Guest import
- Import is an explicit, user-confirmed action from workspace settings.
- The server validates and limits the payload, maps guest client IDs to newly created workspace client IDs, creates invoices and expenses in a database transaction, and records paid invoices as payment ledger entries.
- A stable guest import UUID is stored in the audit log. A workspace row lock and prior-import check prevent a retried import from duplicating records.
- Existing cloud records are retained. The browser guest copy is cleared only after the server confirms success.

## Domain boundaries
- identity: users, sessions, invitations
- workspaces: businesses, memberships, roles, settings
- parties: clients, contacts, addresses
- catalog: products, services, tax codes
- billing: quotes, invoices, line items, credit notes, payment allocations
- money: currencies, exchange rates, monetary arithmetic
- expenses: expenses, categories, attachments
- reporting: read models and exports
- communications: email, reminders, notifications
- markets: country, locale, tax and payment capabilities

## Money representation
Represent a monetary amount as an integer minor-unit amount plus an ISO 4217 currency code. Persist integer minor units in PostgreSQL using BIGINT and persist the currency code separately. Currency exponent is derived from runtime ISO currency metadata through Intl.NumberFormat. Market configuration must still validate which currencies a workspace may select. Do not store formatted strings as financial values.

## Tenant isolation
Every business-owned table carries workspace_id. Enforce membership and role checks in server-side operations. Never trust a client-supplied workspace ID without verifying membership. Tests must prove cross-tenant reads and writes are denied. Guest data is never treated as a tenant until it is imported through the authenticated API.

## Environments
- Local development uses a local PostgreSQL connection.
- Cloudflare preview uses a dedicated Neon preview branch and preview Hyperdrive configuration.
- Production uses a separate Neon production branch and a separate production Hyperdrive configuration.
- Never point preview at production or production at preview. Keep secrets out of source control.

## Release boundaries
- Core guest use does not require registration or payment details.
- The app records payments manually; it does not process card or bank payments.
- Email verification and password recovery require a configured transactional email provider before they can be advertised as operational.
- Tax calculations and jurisdiction-specific invoice compliance are not yet implemented.
- Production DNS and traffic must not be cut over until remote browser acceptance, database isolation, backups, monitoring and recovery are verified.

## Quality gates
- TypeScript strict mode.
- Dependency audit.
- SQL migrations on an isolated PostgreSQL service.
- Unit tests for money and document state transitions.
- Integration tests for authorization and tenant isolation.
- Browser E2E for guest-first entry, guest persistence, guest import, account signup, invoice issue, payment allocation and exports.
- Responsive checks at 320, 375, 768 and 1120 pixels, plus wider desktop coverage.
- Production smoke tests after deployment.
