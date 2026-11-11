# Decision 0003: Guest-first access and optional accounts

- Status: Accepted for the Invoqly release candidate
- Date: 2026-11-11

## Context

The previous application flow redirected visitors to sign-in before they could use the product. This made registration a prerequisite for core functionality, even though basic invoicing and expense tracking should be free and immediately usable.

A signup button alone would not solve the issue because the workspace page and API both required an authenticated session.

## Decision

Invoqly has two explicit access modes:

1. Guest mode at `/guest`: local browser storage for clients, invoices and expenses; invoice drafting, issuing, marking paid, totals, print/save-as-PDF and JSON backup.
2. Account mode: private cloud-backed workspace with server-side persistence and multi-device access.

Guests can create an account later and explicitly import their current browser workspace. Import is validated and transactional, preserves existing cloud records, maps guest client references to newly created database IDs, creates payment ledger entries for paid invoices, and uses an audit-recorded import UUID to make retries idempotent.

## Consequences

- No signup wall or payment details for core guest workflows.
- Guest records remain device-local until import; the UI must explain that browser storage is not a backup.
- Account creation unlocks cloud capabilities rather than basic invoicing.
- The guest import path is a security-sensitive server operation and must remain authenticated, same-origin, size-limited, validated and covered by retry tests.
- The public homepage, account workspace and Cloudflare preview must be tested together before release.
