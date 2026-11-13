import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("public quotation endpoint boundary", () => {
  it("rejects malformed public tokens before database access", async () => {
    const request = new Request("https://app.example/api/public/quotes/not-a-token");
    const response = await GET(request, { params: Promise.resolve({ token: "not-a-token" }) });
    expect(response.status).toBe(404);
  });
  it("rejects cross-origin decisions even when the bearer token is well-formed", async () => {\n    const token="a".repeat(64);\n    const request=new Request("https://app.example/api/public/quotes/"+token,{method:"POST",headers:{"Content-Type":"application/json",origin:"https://attacker.example"},body:JSON.stringify({decision:"Accepted"})});\n    const response=await POST(request,{params:Promise.resolve({token})});\n    expect(response.status).toBe(403);\n  });\n  it("rejects a malformed token before parsing or writing a decision", async () => {
    const request = new Request("https://app.example/api/public/quotes/bad", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "Accepted" }),
    });
    const response = await POST(request, { params: Promise.resolve({ token: "bad" }) });
    expect(response.status).toBe(404);
  });
});
