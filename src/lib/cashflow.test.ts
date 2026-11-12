import { describe, expect, it } from "vitest";
import { calculateCashflow, rankReceivablesToChase, totalChaseImpactMinor, type CashflowInput } from "./cashflow";

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

  it("ranks the largest open receivables and sums their actual recoverable impact", () => {
    const top = rankReceivablesToChase(base, 2);
    expect(top.map(item => item.invoiceId)).toEqual(["i1", "i2"]);
    expect(totalChaseImpactMinor(top)).toBe(6_500_000);
  });
});


  it("matches a hand-calculated weekly and monthly cash movement ledger", () => {
    const result = calculateCashflow(base);
    // Week 1: R65,000 receivables less R15,000 rent, R8,000 supplier and R2,500 contractor.
    expect(result.weeks[0]).toMatchObject({
      inflowsMinor: 6_500_000, outflowsMinor: 2_550_000, netMinor: 3_950_000,
      openingBalanceMinor: 10_000_000, closingBalanceMinor: 13_950_000
    });
    // First monthly period ends 10 Dec: four weekly contractor payments fall in the period.
    expect(result.months[0]).toMatchObject({
      inflowsMinor: 6_500_000, outflowsMinor: 3_300_000, netMinor: 3_200_000,
      openingBalanceMinor: 10_000_000, closingBalanceMinor: 13_200_000
    });
    expect(result.safeToSpendMinor).toBe(8_000_000);
  });

  it("reconciles a delayed-receipt and delayed-supplier scenario against the baseline by hand", () => {
    const baseline = calculateCashflow(base);
    const scenario = calculateCashflow(base, {
      delayedInvoiceIds: ["i1"], invoiceDelayDays: 21,
      delayedPayableIds: ["supplier"], supplierDelayDays: 14
    });
    // In week 1, the R40,000 invoice moves out and the R8,000 supplier bill moves out.
    expect(baseline.weeks[0]?.netMinor).toBe(3_950_000);
    expect(scenario.weeks[0]?.netMinor).toBe(750_000);
    expect((scenario.weeks[0]?.netMinor ?? 0) - (baseline.weeks[0]?.netMinor ?? 0)).toBe(-3_200_000);
    expect(scenario.months.reduce((sum, period) => sum + period.netMinor, 0))
      .toBe(baseline.months.reduce((sum, period) => sum + period.netMinor, 0));
  });
