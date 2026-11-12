import { describe, expect, it } from "vitest";
import { applyDocumentTaxProfile, calculateDocumentTax, calculateDocumentTotal, resolveDocumentLineItems, validateDocumentLineItems } from "./documents";

describe("multi-line document totals", () => {
  it("calculates every line deterministically using integer minor units", () => {
    expect(calculateDocumentTotal([
      { description: "Labour", quantity: 8, unitPriceMinor: 50000 },
      { description: "Materials", quantity: 1, unitPriceMinor: 240000 }
    ])).toBe(640000);
  });

  it("preserves a legacy single-line document when no line array exists", () => {
    expect(resolveDocumentLineItems(undefined, { description: "Services", quantity: 2, unitPriceMinor: 10000 })).toEqual([
      { description: "Services", quantity: 2, unitPriceMinor: 10000 }
    ]);
  });

  it("rejects empty, oversized, fractional and unsafe lines", () => {
    expect(() => validateDocumentLineItems([])).toThrow(/between 1 and 50/);
    expect(() => validateDocumentLineItems(Array.from({ length: 51 }, () => ({ description: "x", quantity: 1, unitPriceMinor: 1 })))).toThrow(/between 1 and 50/);
    expect(() => calculateDocumentTotal([{ description: "x", quantity: 1.5, unitPriceMinor: 100 }])).toThrow(/whole number/);
    expect(() => calculateDocumentTotal([{ description: "x", quantity: 2, unitPriceMinor: Number.MAX_SAFE_INTEGER }])).toThrow(/line 1 total/i);
  });
});

describe("VAT-aware document totals", () => {
  const line = { description: "Professional services", quantity: 1, unitPriceMinor: 11_500 };

  it("extracts 15% VAT from inclusive South African prices with integer rounding", () => {
    const lines = applyDocumentTaxProfile([line], { vatRegistered: true, taxDate: "2026-11-12", priceMode: "inclusive" });
    expect(lines[0]?.taxRateBasisPoints).toBe(1500);
    expect(calculateDocumentTax(lines)).toMatchObject({ netMinor: 10_000, taxMinor: 1_500, grossMinor: 11_500 });
    expect(calculateDocumentTotal(lines)).toBe(11_500);
  });

  it("adds VAT to exclusive prices without asking AI to calculate it", () => {
    const lines = applyDocumentTaxProfile([{ ...line, unitPriceMinor: 10_000 }], { vatRegistered: true, taxDate: "2026-11-12", priceMode: "exclusive" });
    expect(calculateDocumentTax(lines)).toMatchObject({ netMinor: 10_000, taxMinor: 1_500, grossMinor: 11_500 });
    expect(calculateDocumentTotal(lines)).toBe(11_500);
  });

  it("keeps non-registered workspaces outside VAT and rejects a false VAT claim", () => {
    const lines = applyDocumentTaxProfile([line], { vatRegistered: false, taxDate: "2026-11-12" });
    expect(calculateDocumentTax(lines)).toMatchObject({ netMinor: 11_500, taxMinor: 0, grossMinor: 11_500 });
    expect(() => applyDocumentTaxProfile([{ ...line, taxTreatment: "standard" }], { vatRegistered: false, taxDate: "2026-11-12" })).toThrow(/VAT-registered workspace/);
  });

  it("preserves historic VAT rates on documents created before 1 April 2018", () => {
    const lines = applyDocumentTaxProfile([line], { vatRegistered: true, taxDate: "2018-03-31", priceMode: "inclusive" });
    expect(lines[0]?.taxRateBasisPoints).toBe(1400);
    expect(calculateDocumentTax(lines).taxMinor).toBe(1_412);
  });

  it("does not add VAT to zero-rated, exempt or out-of-scope lines", () => {
    for (const treatment of ["zero_rated", "exempt", "out_of_scope"] as const) {
      const lines = applyDocumentTaxProfile([{ ...line, taxTreatment: treatment }], { vatRegistered: true, taxDate: "2026-11-12" });
      expect(calculateDocumentTax(lines).taxMinor).toBe(0);
      expect(calculateDocumentTotal(lines)).toBe(11_500);
    }
  });

  it("supports mixed tax treatments on different lines of one document", () => {
    const lines = applyDocumentTaxProfile([
      line,
      { description: "Qualifying zero-rated supply", quantity: 1, unitPriceMinor: 5_000, taxTreatment: "zero_rated" }
    ], { vatRegistered: true, taxDate: "2026-11-12", priceMode: "inclusive" });
    expect(calculateDocumentTax(lines)).toMatchObject({ netMinor: 15_000, taxMinor: 1_500, grossMinor: 16_500 });
    expect(lines.map(item => item.taxTreatment)).toEqual(["standard", "zero_rated"]);
  });
});
