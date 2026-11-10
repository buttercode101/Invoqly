import { describe, expect, it } from "vitest";
import { addMoney, currencyExponent, formatMoney, makeMoney } from "./money";

describe("money domain", () => {
  it("adds only amounts in the same currency", () => {
    expect(addMoney(makeMoney(1250n,"USD"),makeMoney(750n,"USD"))).toEqual({amountMinor:2000n,currency:"USD"});
  });
  it("rejects cross-currency addition", () => {
    expect(() => addMoney(makeMoney(100n,"USD"),makeMoney(100n,"ZAR"))).toThrow(/different currencies/);
  });
  it("uses zero-, two- and three-decimal currency exponents", () => {
    expect(currencyExponent("JPY")).toBe(0);
    expect(currencyExponent("ZAR")).toBe(2);
    expect(currencyExponent("KWD")).toBe(3);
  });
  it("formats using the requested locale and currency", () => {
    expect(formatMoney(makeMoney(123456n,"USD"),"en-US")).toBe("$1,234.56");
    expect(formatMoney(makeMoney(123456n,"ZAR"),"en-ZA")).toContain("1 234,56");
  });
  it("rejects malformed currency codes and unsafe amounts", () => {
    expect(() => makeMoney(1n,"US")).toThrow(/ISO code/);
    expect(() => formatMoney(makeMoney(BigInt(Number.MAX_SAFE_INTEGER)+1n,"USD"),"en-US")).toThrow(/safe formatting/);
  });
});
