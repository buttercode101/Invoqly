import { describe, expect, it } from "vitest";
import { calculateDocumentTotal, resolveDocumentLineItems, validateDocumentLineItems } from "./documents";

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
