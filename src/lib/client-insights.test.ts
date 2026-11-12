import { describe, expect, it } from "vitest";
import { buildClientPaymentProfiles } from "./client-insights";

describe("client payment profiles", () => {
  const base = {
    asOfDate: "2026-11-12",
    clients: [{ id: "c1", name: "Client One", currency: "ZAR" }],
    invoices: [
      { id: "i1", clientId: "c1", issueDate: "2026-10-01", dueDate: "2026-10-15", quantity: 1, unitPriceMinor: 10_000, currency: "ZAR", status: "Paid" },
      { id: "i2", clientId: "c1", issueDate: "2026-10-20", dueDate: "2026-11-01", quantity: 1, unitPriceMinor: 20_000, currency: "ZAR", status: "Paid" },
      { id: "i3", clientId: "c1", issueDate: "2026-11-02", dueDate: "2026-11-10", quantity: 1, unitPriceMinor: 15_000, currency: "ZAR", status: "Overdue" }
    ],
    payments: [
      { invoiceId: "i1", date: "2026-10-10", amountMinor: 10_000, currency: "ZAR", method: "Bank transfer" },
      { invoiceId: "i2", date: "2026-11-04", amountMinor: 20_000, currency: "ZAR", method: "Cash" }
    ]
  };

  it("derives on-time rate, average days to pay, preferred method and overdue balance", () => {
    expect(buildClientPaymentProfiles(base)).toEqual([{
      clientId: "c1", clientName: "Client One", currency: "ZAR",
      onTimeRatePercent: 33, averageDaysToPay: 12, preferredPaymentMethod: "Cash",
      overdueBalanceMinor: 15_000, dueInvoiceCount: 3, onTimeInvoiceCount: 1,
      paidInvoiceCount: 2, lateInvoiceCount: 2, confidence: "medium"
    }]);
  });

  it("does not invent a score when the client has no due invoices", () => {
    const result = buildClientPaymentProfiles({ ...base, invoices: [] })[0];
    expect(result?.onTimeRatePercent).toBeNull();
    expect(result?.averageDaysToPay).toBeNull();
    expect(result?.confidence).toBe("none");
  });

  it("ignores draft and foreign-currency invoices instead of mixing currencies", () => {
    const result = buildClientPaymentProfiles({
      ...base,
      invoices: [
        ...base.invoices,
        { id: "draft", clientId: "c1", issueDate: "2026-10-01", dueDate: "2026-10-02", quantity: 1, unitPriceMinor: 50_000, currency: "ZAR", status: "Draft" },
        { id: "usd", clientId: "c1", issueDate: "2026-10-01", dueDate: "2026-10-02", quantity: 1, unitPriceMinor: 50_000, currency: "USD", status: "Overdue" }
      ]
    })[0];
    expect(result?.dueInvoiceCount).toBe(3);
    expect(result?.overdueBalanceMinor).toBe(15_000);
  });

  it("rejects unsafe payment amounts and invalid dates", () => {
    expect(() => buildClientPaymentProfiles({ ...base, payments: [{ invoiceId: "i1", date: "2026-10-10", amountMinor: Number.MAX_SAFE_INTEGER + 1, currency: "ZAR", method: "Cash" }] })).toThrow(/positive safe integers/);
    expect(() => buildClientPaymentProfiles({ ...base, asOfDate: "2026-02-30" })).toThrow(/valid calendar date/);
  });
});
