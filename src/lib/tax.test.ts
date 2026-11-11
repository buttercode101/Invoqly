import { describe, expect, it } from "vitest";
import { calculateTaxLine, prepareSouthAfricanVat201, southAfricanVatRateBasisPoints, validateSouthAfricanTaxInvoice, type VatTransaction } from "./tax";

describe("deterministic tax engine", () => {
  it("uses South Africa's historic 14% and current 15% standard rates by tax date", () => {
    expect(southAfricanVatRateBasisPoints("2018-03-31")).toBe(1400);
    expect(southAfricanVatRateBasisPoints("2018-04-01")).toBe(1500);
    expect(southAfricanVatRateBasisPoints("2026-11-11")).toBe(1500);
  });

  it("calculates inclusive and exclusive VAT with integer half-up rounding", () => {
    expect(calculateTaxLine(10_000, 1500, "exclusive")).toEqual({ netMinor: 10_000, taxMinor: 1_500, grossMinor: 11_500, rateBasisPoints: 1500 });
    expect(calculateTaxLine(10_000, 1500, "inclusive")).toEqual({ netMinor: 8_696, taxMinor: 1_304, grossMinor: 10_000, rateBasisPoints: 1500 });
  });

  it("keeps zero-rated, exempt and out-of-scope supplies tax-free", () => {
    for (const category of ["zero_rated", "exempt", "out_of_scope"] as const) {
      expect(calculateTaxLine(25_000, 0, "exclusive").taxMinor).toBe(0);
      const transaction: VatTransaction = { id: category, date: "2026-11-01", direction: "sale", treatment: category, amountMinor: 25_000, currency: "ZAR", priceMode: "exclusive" };
      expect(prepareSouthAfricanVat201("2026-11-01", "2026-11-30", [transaction]).outputVatMinor).toBe(0);
    }
  });

  it("prepares a conservative VAT201 working summary and only claims verified input VAT", () => {
    const rows: VatTransaction[] = [
      { id: "sale", date: "2026-11-02", direction: "sale", treatment: "standard", amountMinor: 115_000, currency: "ZAR", priceMode: "inclusive" },
      { id: "capital", date: "2026-11-03", direction: "purchase", treatment: "standard", amountMinor: 23_000, currency: "ZAR", priceMode: "inclusive", capitalGoods: true, inputTaxClaimed: true, supportingDocumentVerified: true },
      { id: "no-proof", date: "2026-11-04", direction: "purchase", treatment: "standard", amountMinor: 11_500, currency: "ZAR", priceMode: "inclusive", inputTaxClaimed: true, supportingDocumentVerified: false }
    ];
    const result = prepareSouthAfricanVat201("2026-11-01", "2026-11-30", rows);
    expect(result.standardRatedSalesExVatMinor).toBe(100_000);
    expect(result.outputVatMinor).toBe(15_000);
    expect(result.capitalGoodsInputVatMinor).toBe(3_000);
    expect(result.inputVatMinor).toBe(3_000);
    expect(result.unclaimedPurchaseVatMinor).toBe(1_500);
    expect(result.netVatPayableMinor).toBe(12_000);
    expect(result.warnings).toHaveLength(1);
  });

  it("excludes transactions outside the period and rejects implicit FX conversion", () => {
    const outside: VatTransaction = { id: "old", date: "2026-10-31", direction: "sale", treatment: "standard", amountMinor: 115_000, currency: "ZAR", priceMode: "inclusive" };
    expect(prepareSouthAfricanVat201("2026-11-01", "2026-11-30", [outside]).transactionCount).toBe(0);
    const usd = { ...outside, id: "usd", date: "2026-11-02", currency: "USD" };
    expect(() => prepareSouthAfricanVat201("2026-11-01", "2026-11-30", [usd])).toThrow(/requires ZAR/);
  });

  it("checks the SARS tax-invoice thresholds and required supplier details", () => {
    expect(validateSouthAfricanTaxInvoice({ currency: "ZAR", considerationZarMinor: 5_000, supplierVatRegistered: true }).requiredDocument).toBe("not_required");
    expect(validateSouthAfricanTaxInvoice({ currency: "ZAR", considerationZarMinor: 5_001, supplierVatRegistered: true }).requiredDocument).toBe("abridged");
    const full = validateSouthAfricanTaxInvoice({ currency: "ZAR", considerationZarMinor: 500_001, supplierVatRegistered: true });
    expect(full.requiredDocument).toBe("full");
    expect(full.valid).toBe(false);
    expect(full.errors).toContain("Supplier VAT registration number is required.");
  });

  it("requires a full tax invoice for zero-rated supplies even below the abridged threshold", () => {
    const result = validateSouthAfricanTaxInvoice({
      currency: "ZAR",
      considerationZarMinor: 1_000,
      supplierVatRegistered: true,
      zeroRatedSupply: true
    });
    expect(result.requiredDocument).toBe("full");
    expect(result.valid).toBe(false);
    expect(result.errors).toContain("Recipient name is required.");
  });

  it("rejects invalid VAT rates and unsafe amounts", () => {
    expect(() => calculateTaxLine(100, 15_001, "exclusive")).toThrow(/between 0% and 100%/);
    expect(() => calculateTaxLine(Number.MAX_SAFE_INTEGER, 10_000, "exclusive")).toThrow(/supported range/);
  });
});
