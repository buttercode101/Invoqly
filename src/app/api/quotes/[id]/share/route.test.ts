import { describe, expect, it } from "vitest";
import { POST } from "./route";

describe("quotation approval link ownership boundary", () => {
  it("rejects cross-origin requests before workspace lookup", async () => {
    const request = new Request("https://app.example/api/quotes/11111111-1111-4111-8111-111111111111/share", {
      method: "POST", headers: { origin: "https://attacker.example" },
    });
    const response = await POST(request, { params: Promise.resolve({ id: "11111111-1111-4111-8111-111111111111" }) });
    expect(response.status).toBe(403);
  });
});
