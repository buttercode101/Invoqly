# Invoqly tax engine

The tax engine is deliberately separate from AI. AI may extract or suggest transaction metadata; deterministic functions calculate tax and totals.

## South African VAT

- Standard VAT is 15% from 1 April 2018; the engine also recognises the historic 14% rate before that date.
- Zero-rated, exempt and out-of-scope treatments remain distinct.
- Prices can be tax-exclusive or tax-inclusive. All arithmetic uses integer minor currency units and half-up rounding.
- VAT201 preparation is a working summary, not a return submission or tax opinion.
- Input tax is included only when the transaction is explicitly marked as claimed and its supporting document has been verified. Business-use apportionment is explicit.
- Foreign-currency transactions are not silently converted into ZAR. A documented exchange rate and converted amount must be supplied before VAT201 inclusion.
- The tax-invoice checklist applies the SARS R50 and R5,000 consideration thresholds and requires the published supplier/recipient and transaction details.

## Boundaries still required before production tax use

- Persist supplier VAT status, VAT number, business address, tax basis and tax period settings.
- Persist tax treatment and tax amount per document line and expense.
- Separate exports from other zero-rated supplies and map all VAT201 fields and adjustments.
- Support credit/debit notes, bad-debt adjustments, imported services, capital-goods classifications and special time-of-supply rules.
- Have a South African tax practitioner review the completed VAT201 mapping and tax-invoice output before describing it as SARS-compliant.

Sources:
- SARS, Value-Added Tax: https://www.sars.gov.za/types-of-tax/value-added-tax/
- SARS, Tax Invoices: https://www.sars.gov.za/businesses-and-employers/government/tax-invoices/
- SARS, VAT201 Guide: https://www.sars.gov.za/guide-to-completing-the-value-added-tax-vat201-return/
