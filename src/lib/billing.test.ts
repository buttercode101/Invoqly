import { describe, expect, it } from "vitest";
import { deriveInvoiceStatus, outstandingBalanceMinor } from "./billing";

describe("invoice balance",()=>{
  it("subtracts multiple payments without floating-point arithmetic",()=>{
    expect(outstandingBalanceMinor(250100,[100000,150000])).toBe(100);
  });
  it("returns zero when fully paid",()=>{
    expect(outstandingBalanceMinor(250100,[100000,150100])).toBe(0);
  });
  it("rejects payments that exceed the invoice total",()=>{
    expect(()=>outstandingBalanceMinor(1000,[600,401])).toThrow(/exceed the invoice total/i);
  });
  it("rejects negative or unsafe amounts",()=>{
    expect(()=>outstandingBalanceMinor(1000,[-1])).toThrow(/non-negative safe integer/i);
    expect(()=>outstandingBalanceMinor(Number.MAX_SAFE_INTEGER+1,[])).toThrow(/non-negative safe integer/i);
  });
});

describe("invoice status",()=>{
  it("keeps an unpaid invoice sent before its due date",()=>{
    expect(deriveInvoiceStatus(10000,0,"2026-11-20","2026-11-10")).toBe("Sent");
  });
  it("marks a partially paid invoice correctly",()=>{
    expect(deriveInvoiceStatus(10000,2500,"2026-11-20","2026-11-10")).toBe("Partially paid");
  });
  it("marks any outstanding balance overdue after the due date",()=>{
    expect(deriveInvoiceStatus(10000,2500,"2026-11-09","2026-11-10")).toBe("Overdue");
  });
  it("marks an invoice paid even when the due date has passed",()=>{
    expect(deriveInvoiceStatus(10000,10000,"2026-11-01","2026-11-10")).toBe("Paid");
  });
  it("rejects overpayments and malformed dates",()=>{
    expect(()=>deriveInvoiceStatus(10000,10001,"2026-11-20","2026-11-10")).toThrow(/exceed/i);
    expect(()=>deriveInvoiceStatus(10000,0,"20-11-2026","2026-11-10")).toThrow(/YYYY-MM-DD/);
  });
});
