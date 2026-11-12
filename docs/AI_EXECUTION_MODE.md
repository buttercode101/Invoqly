# Supervised AI execution mode

## Current capability

The authenticated AI co-pilot has two modes:

- **Assist** prepares drafts, explanations and analyses. It does not write business records.
- **Execution** can prepare a payment-recording proposal for one existing invoice. The user must explicitly confirm the proposal before the payment is written.

The first execution action is intentionally limited to **full settlement**. Partial payments remain available through the existing Payments form.

## Payment safety

1. The model may identify an exact invoice number, but it never supplies the payment amount.
2. The server resolves the invoice from the authenticated workspace and verifies that the current request names its invoice number or customer.
3. The server calculates the document total and sums recorded payments using the application's financial functions.
4. The server only proposes the exact outstanding balance. It rejects multiple amounts, currency mismatches, partial payments, overpayments, drafts and already-paid invoices.
5. The UI displays the invoice, customer, payment date, current balance and full settlement amount.
6. No write occurs until the user presses **Confirm and record payment**. Cancel discards the proposal.
7. Confirmation uses the existing workspace payment transaction, row lock, balance validation and audit-event write. A repeated full-settlement attempt is rejected once the outstanding balance is zero.

## Explicit non-goals

Execution mode does not currently:

- initiate bank transfers or collect card payments;
- send email, WhatsApp or other external messages;
- automatically mark invoices paid based on external payment claims;
- record partial payments;
- create or delete expenses, invoices, clients or other records;
- execute multiple actions in a batch.

Future actions must use explicit user approval, server-side deterministic calculations, workspace ownership checks, validation, audit events and idempotency protection before they are enabled.
