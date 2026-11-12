import { describe, expect, it } from "vitest";
import { calculateCashflow, cashflowInvoiceFromDocument, rankReceivablesToChase, totalChaseImpactMinor, type CashflowInput } from "./cashflow";

const base: CashflowInput = {
  asOfDate: "2026-11-11",
  currency: "ZAR",
  openingBalanceMinor: 100_000_00,
  reserveMinor: 20_000_00,
  invoices: [
    { id: "i1", number: "INV-1", customerName: "Client A", dueDate: "2026-11-12", amountMinor: 50_000_00, paidMinor: 10_000_00, status: "Partially paid", currency: "ZAR" },
    { id: "i2", number: "INV-2", customerName: "Client B", dueDate: "2026-10-30", amountMinor: 25_000_00, status: "Overdue", currency: "ZAR" },
    { id: "i3", number: "INV-3", customerName: "Client C", dueDate: "2026-11-15", amountMinor: 9_000_00, status: "Draft", currency: "ZAR" },
    { id: "i4", number: "INV-4", customerName: "Client D", dueDate: "2026-11-15", amountMinor: 12_000_00, status: "Paid", currency: "ZAR" }
  ],
  outflows: [{ id: "rent", label: "Rent", date: "2026-11-13", amountMinor: 15_000_00, currency: "ZAR" }],
  payables: [{ id: "supplier", label: "Supplier invoice", dueDate: "2026-11-14", amountMinor: 8_000_00, currency: "ZAR" }],
  recurring: [{ id: "salary", label: "Weekly contractor", direction: "outflow", amountMinor: 2_500_00, currency: "ZAR", frequency: "weekly", startDate: "2026-11-13" }]
};

describe("deterministic cash-flow engine", () => {
  it("creates 13 weekly and 12 monthly periods and excludes draft/paid invoices", () => {
    const result = calculateCashflow(base);
    expect(result.weeks).toHaveLength(13);
    expect(result.months).toHaveLength(12);
    expect(result.months[0]?.startDate).toBe("2026-11-11");
    expect(result.months[11]?.endDate).toBe("2027-11-10");
    expect(result.events.some(event => event.id === "invoice:i3")).toBe(false);
    expect(result.events.some(event => event.id === "invoice:i4")).toBe(false);
    expect(result.events.find(event => event.id === "invoice:i1")?.amountMinor).toBe(4_000_000);
  });

  it("moves selected invoice receipts and supplier payments in a scenario", () => {
    const baseline = calculateCashflow(base);
    const scenario = calculateCashflow(base, { delayedInvoiceIds: ["i1"], invoiceDelayDays: 21, delayedPayableIds: ["supplier"], supplierDelayDays: 14 });
    expect(scenario.events.find(event => event.id === "invoice:i1")?.date).toBe("2026-12-03");
    expect(scenario.events.find(event => event.id === "payable:supplier")?.date).toBe("2026-11-28");
    expect(scenario.weeks[0]?.netMinor).toBeLessThan(baseline.weeks[0]?.netMinor ?? 0);
  });

  it("handles month-end recurrence without overflowing February", () => {
    const result = calculateCashflow({
      ...base,
      asOfDate: "2027-01-31",
      invoices: [],
      outflows: [],
      payables: [],
      recurring: [{ id: "rent", label: "Rent", direction: "outflow", amountMinor: 10_000, currency: "ZAR", frequency: "monthly", startDate: "2027-01-31", dayOfMonth: 31 }]
    });
    expect(result.events.slice(0, 3).map(event => event.date)).toEqual(["2027-01-31", "2027-02-28", "2027-03-31"]);
  });

  it("uses the lowest daily balance, not only the weekly closing balance, for safe-to-spend", () => {
    const result = calculateCashflow({
      ...base,
      openingBalanceMinor: 1_000_000,
      reserveMinor: 0,
      invoices: [{ id: "late", number: "INV-LATE", customerName: "Late payer", dueDate: "2026-11-17", amountMinor: 1_000, status: "Sent", currency: "ZAR" }],
      outflows: [{ id: "large-bill", label: "Large bill", date: "2026-11-12", amountMinor: 950_000, currency: "ZAR" }],
      payables: [],
      recurring: []
    });
    expect(result.weeks[0]?.closingBalanceMinor).toBe(51_000);
    expect(result.lowestProjectedBalanceMinor).toBe(50_000);
    expect(result.lowestProjectedBalanceDate).toBe("2026-11-12");
  });

  it("does not invent safe-to-spend when opening cash is unknown", () => {
    const result = calculateCashflow({ ...base, openingBalanceMinor: null });
    expect(result.safeToSpendMinor).toBeNull();
    expect(result.weeks[0]?.closingBalanceMinor).toBeNull();
  });

  it("rejects implicit FX mixing and unsafe arithmetic", () => {
    expect(() => calculateCashflow({ ...base, invoices: [...base.invoices, { id: "usd", number: "USD-1", customerName: "Global", dueDate: "2026-11-15", amountMinor: 100, status: "Sent", currency: "USD" }] })).toThrow(/forecast currency/);
    expect(() => calculateCashflow({ ...base, openingBalanceMinor: Number.MAX_SAFE_INTEGER })).toThrow(/safe integer range/);
  });


  it("forecasts the full multi-line VAT-inclusive invoice total less recorded payments", () => {
    const invoice = cashflowInvoiceFromDocument({
      id: "multi", number: "INV-MULTI", customerName: "Multi-line client",
      dueDate: "2026-11-13", description: "Labour", quantity: 1, unitPriceMinor: 10_000,
      lineItems: [
        { description: "Labour", quantity: 1, unitPriceMinor: 10_000, taxTreatment: "standard", priceMode: "exclusive", taxRateBasisPoints: 1500 },
        { description: "Materials", quantity: 1, unitPriceMinor: 5_000, taxTreatment: "zero_rated", priceMode: "exclusive", taxRateBasisPoints: 0 }
      ],
      paidMinor: 3_000, status: "Partially paid", currency: "ZAR"
    });
    expect(invoice.amountMinor).toBe(16_500);
    const result = calculateCashflow({
      asOfDate: "2026-11-12", currency: "ZAR", openingBalanceMinor: null,
      invoices: [invoice]
    });
    expect(result.events).toHaveLength(1);
    expect(result.events[0]?.amountMinor).toBe(13_500);
  });

  it("ranks the largest open receivables and sums their actual recoverable impact", () => {
    const top = rankReceivablesToChase(base, 2);
    expect(top.map(item => item.invoiceId)).toEqual(["i1", "i2"]);
    expect(totalChaseImpactMinor(top)).toBe(6_500_000);
  });
  it("matches a manual downside calculation when an outflow arrives before a late receipt", () => {
    const result = calculateCashflow({
      asOfDate: "2026-11-12",
      currency: "ZAR",
      openingBalanceMinor: 10_000,
      reserveMinor: 5_000,
      invoices: [{ id: "late", number: "INV-LATE", customerName: "Late payer", dueDate: "2026-11-15", amountMinor: 2_000, status: "Sent", currency: "ZAR" }],
      outflows: [{ id: "rent", label: "Rent", date: "2026-11-13", amountMinor: 12_000, currency: "ZAR" }]
    });
    expect(result.lowestProjectedBalanceMinor).toBe(-2_000);
    expect(result.lowestProjectedBalanceDate).toBe("2026-11-13");
    expect(result.safeToSpendMinor).toBe(0);
    expect(result.weeks[0]?.closingBalanceMinor).toBe(0);
  });

  it("does not schedule a delayed receivable beyond the forecast horizon", () => {
    const result = calculateCashflow({
      asOfDate: "2026-11-12",
      currency: "ZAR",
      openingBalanceMinor: null,
      invoices: [{ id: "late", number: "INV-LATE", customerName: "Late payer", dueDate: "2027-11-10", amountMinor: 5_000, status: "Sent", currency: "ZAR" }]
    }, { delayedInvoiceIds: ["late"], invoiceDelayDays: 30 });
    expect(result.events).toHaveLength(0);
  });
});
