# Invoqly Product Blueprint

## Product thesis
Invoqly helps independent professionals and small businesses stay on top of the money and operational work around getting paid. It should feel like a calm, capable business workspace—not an accounting suite designed for finance departments.

## Audience
- Freelancers and independent professionals
- Consultants and small agencies
- Service businesses and micro-businesses
- Small teams that need shared visibility without enterprise complexity

## Market approach
Global product architecture from day one. South Africa is the first supported market and must receive complete, first-class workflows. Country-specific behaviour belongs in market configuration, never scattered hardcoded assumptions.

## Product pillars
1. **Get paid:** quotes, invoices, recurring invoices, deposits, partial payments, credit notes, receipts, reminders and client-facing payment pages.
2. **Know your clients:** client records, contacts, billing details, activity history, statements and client portal.
3. **Understand the business:** expenses, categories, attachments, cash flow, receivables, payables and exports.
4. **Work with confidence:** optional business accounts, secure cloud workspaces, roles, audit history, backups, imports and data portability.
5. **Work globally:** ISO currency codes, locale-aware formatting, country-specific tax profiles, time zones and payment-provider adapters.

## Product rules
- **No signup wall for core use.** A visitor can create clients, invoices and expenses, track basic invoice status, print documents and export a backup before creating an account.
- Guest data stays in the current browser until the user explicitly imports it into a signed-in cloud workspace. Clearly explain the device-local storage boundary and offer backup export.
- Accounts unlock private cloud persistence, recovery and multi-device access. Never require an account merely to create a basic invoice.
- Guest-to-account import must preserve existing cloud records, validate all data server-side, run transactionally and be idempotent on retry.
- Issued invoices are financial documents; corrections use explicit credit/reissue workflows.
- Store money as integer minor units with an ISO 4217 currency code. Never use floating-point arithmetic for financial calculations.
- Never silently convert transaction currency. FX conversion is an explicit, dated reporting operation with a recorded rate and source.
- Tax is configured by jurisdiction and effective date; no global default VAT rate.
- Every tenant-owned record is scoped to a business/workspace.
- Sample data is visibly labelled and must never be confused with a connected account.
- Data export and deletion are first-class product capabilities.

## Initial release scope
- Public landing page with a clear no-account entry path
- Guest workspace for clients, invoices, invoice status, expenses, dashboard totals, print/PDF and JSON backup
- Optional account creation and sign-in for cloud-backed workspaces
- Explicit guest-to-account import with duplicate prevention
- Business profile, locale and currency
- Clients and invoices with server-generated numbering and PDF output
- Invoice lifecycle and payment recording
- Expense capture and categories
- Overview dashboard and receivables reporting
- CSV export, backup and restore
- Responsive PWA shell

## Later releases
Payment-provider integrations by supported market; automated email delivery and reminders; client portal and self-service payment; recurring billing automation; multi-user roles and approvals; advanced analytics and AI-assisted workflows.

## Explicit non-goals for first release
Full double-entry accounting, payroll, inventory management, tax filing, lending, banking and multi-entity consolidation. These require separate product and compliance decisions.

## Design direction
Editorial, precise, warm-neutral interface; deep evergreen as a restrained accent; excellent typography, generous whitespace, clear data hierarchy, compact purposeful surfaces, strong contrast and subtle motion. Avoid generic gradient-heavy SaaS styling, oversized cards and decorative clutter.
