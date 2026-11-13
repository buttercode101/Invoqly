import {describe,expect,it} from "vitest";
import {createQuoteToken,hashQuoteToken,isSameOriginRequest,isValidQuoteToken} from "./quote-share";
describe("quotation approval tokens",()=>{
 it("creates random 256-bit tokens and stores a one-way digest",async()=>{
  const a=createQuoteToken(),b=createQuoteToken();
  expect(a).toMatch(/^[a-f0-9]{64}$/);expect(b).not.toBe(a);
  const hash=await hashQuoteToken(a);expect(hash).toMatch(/^[a-f0-9]{64}$/);expect(hash).not.toBe(a);
  expect(await hashQuoteToken(a)).toBe(hash);
 });
 it("rejects malformed tokens",async()=>{await expect(hashQuoteToken("bad")).rejects.toThrow(/invalid/i);expect(isValidQuoteToken("bad")).toBe(false);expect(isValidQuoteToken("a".repeat(64))).toBe(true)});
 it("enforces same-origin writes",()=>{expect(isSameOriginRequest(new Request("https://app.example/api",{method:"POST",headers:{origin:"https://app.example"}}))).toBe(true);expect(isSameOriginRequest(new Request("https://app.example/api",{method:"POST",headers:{origin:"https://attacker.example"}}))).toBe(false);expect(isSameOriginRequest(new Request("https://app.example/api",{method:"POST"}))).toBe(false)});
});
