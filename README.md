# Invoqly

A global business finance workspace for independent professionals and small businesses.

## Product principles

- Global by design; South Africa is the first supported market, not a hardcoded boundary.
- Accurate money handling: integer minor units, explicit currency codes, no implicit currency conversion.
- Clear separation between presentation, domain logic, and persistence.
- Secure, tenant-aware data access before production customer onboarding.
- Accessible, responsive, premium interface without decorative complexity.

## Development status

Initial application foundation is being established. No production customer data or InvoiceFlow infrastructure is connected to this project.

## Planned foundation

- Next.js App Router, TypeScript, React
- Tailwind CSS and a documented design system
- Zod validation at input boundaries
- Vitest for domain and component tests
- Supabase for planned authentication and PostgreSQL persistence (not enabled until configured)

## Local development

```bash
npm install
npm run dev
```

See `docs/PRODUCT_BLUEPRINT.md` and `docs/ARCHITECTURE.md` for the current product and engineering direction.