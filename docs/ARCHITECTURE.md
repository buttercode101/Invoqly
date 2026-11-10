# Invoqly Architecture

## Current foundation
- Next.js App Router + React + TypeScript
- CSS design tokens and responsive component styling
- Explicit domain validation in the money and workflow boundaries
- Playwright browser acceptance tests against the production build
- Lucide icons
- Vercel-compatible deployment target

## Target production architecture
- Next.js server components/actions and route handlers
- Supabase Auth for identity
- PostgreSQL with tenant-scoped relational model and Row Level Security
- Private object storage for invoice PDFs and attachments
- Background job provider for reminders, recurring documents and email
- Provider adapters for payment gateways and FX rates

The current functional preview persists records in browser local storage only. This is not suitable for real customer or financial data. No external service is considered configured until credentials, migrations, access policies and live integration tests are present. Never commit secrets.

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
Represent a monetary amount as an integer minor-unit amount plus an ISO 4217 currency code. Persist integer minor units in PostgreSQL using BIGINT and persist the currency code separately. Currency exponent is derived from the runtime's ISO currency metadata through Intl.NumberFormat. Market configuration must still validate which currencies a workspace may select. Do not store formatted strings as financial values.

## Tenant isolation
Every business-owned table carries workspace_id. Enforce membership and role checks in server-side operations and PostgreSQL RLS. Never trust a client-supplied workspace ID without verifying membership. Tests must prove cross-tenant reads and writes are denied.

## Environments
Local development, preview deployments and production must use separate credentials and databases. Production secrets are Vercel environment variables, never source files. Migrations are reviewed and applied deliberately.

## Quality gates
- TypeScript strict mode
- Lint and formatting
- Unit tests for money, tax and document state transitions
- Integration tests for authorization and tenant isolation
- Browser E2E for quote-to-invoice, invoice issue, payment allocation and exports
- Responsive checks at 320, 360, 375, 768, 1024 and 1440 pixels
- Production smoke tests after deployment
