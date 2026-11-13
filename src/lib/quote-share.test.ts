import { describe, expect, it } from "vitest";
import { createQuoteToken, hashQuoteToken } from "./quote-share";

describe("secure quotation share tokens", () => {
  it("creates random 256-bit hex tokens and stores only a one-way digest", async () => {
    const first = createQuoteToken();
    const second = createQuoteToken();
    expect(first).toMatch(/^[a-f0-9]{64}$/);
    expect(second).toMatch(/^[a-f0-9]{64}$/);
    expect(first).not.toBe(second);
    const hash = await hashQuoteToken(first);
    expect(hash).toMatch(/^[a-f0-9]{64}$/);
    expect(hash).not.toBe(first);
    expect(await hashQuoteToken(first)).toBe(hash);
  });
  it("rejects malformed public tokens", async () => {
    await expect(hashQuoteToken("short")).rejects.toThrow(/invalid/i);
  });
});
