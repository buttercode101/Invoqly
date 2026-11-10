import { describe, expect, it } from "vitest";
import { addMoney, currencyExponent, decimalToMinor, formatMinor, formatMoney, makeMoney } from "./money";

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
    expect(currencyExponent("CLF")).toBe(4);
    expect(() => currencyExponent("ZZZ")).toThrow(/Unsupported ISO 4217/);
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

describe("minor-unit input and formatting", () => {
  it("converts decimal strings to integer minor units", () => {
    expect(decimalToMinor("1234.56","ZAR")).toBe(123456);
    expect(decimalToMinor("1200","JPY")).toBe(1200);
    expect(decimalToMinor("1.234","KWD")).toBe(1234);
  });
  it("rejects excessive decimal precision and unsafe amounts", () => {
    expect(() => decimalToMinor("1.234","USD")).toThrow(/decimal places/);
    expect(() => decimalToMinor("9007199254740992.00","USD")).toThrow(/too large/);
    expect(() => decimalToMinor("-1.00","USD")).toThrow(/valid/);
  });
  it("formats integer minor units in the requested currency", () => {
    expect(formatMinor(123456,"USD","en-US")).toBe("$1,234.56");
    expect(formatMinor(123456,"ZAR","en-ZA")).toContain("1 234,56");
  });
});
