import { describe, expect, it } from "vitest";
import { GET, POST } from "./route";

describe("public quotation endpoint boundary", () => {
  it("rejects malformed public tokens before database access", async () => {
    const request = new Request("https://app.example/api/public/quotes/not-a-token");
    const response = await GET(request, { params: Promise.resolve({ token: "not-a-token" }) });
    expect(response.status).toBe(404);
  });
  it("rejects a malformed token before parsing or writing a decision", async () => {
    const request = new Request("https://app.example/api/public/quotes/bad", {
      method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ decision: "Accepted" }),
    });
    const response = await POST(request, { params: Promise.resolve({ token: "bad" }) });
    expect(response.status).toBe(404);
  });
});
