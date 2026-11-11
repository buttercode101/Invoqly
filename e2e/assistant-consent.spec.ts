import { expect, test } from "@playwright/test";

test("AI co-pilot requires explicit consent and an authenticated account", async ({ request, baseURL }) => {
  const origin = baseURL ?? "http://127.0.0.1:3000";
  const headers = { Origin: origin, "Content-Type": "application/json" };

  const initial = await request.get("/api/assistant/consent");
  expect(initial.ok()).toBeTruthy();
  expect((await initial.json()).accepted).toBe(false);

  const blocked = await request.post("/api/assistant", {
    headers,
    data: { message: "Create an invoice", history: [] }
  });
  expect(blocked.status()).toBe(428);

  const accepted = await request.post("/api/assistant/consent", {
    headers,
    data: { accepted: true }
  });
  expect(accepted.ok()).toBeTruthy();
  expect((await accepted.json()).accepted).toBe(true);

  const enabled = await request.get("/api/assistant/consent");
  expect((await enabled.json()).accepted).toBe(true);

  const guestBlocked = await request.post("/api/assistant", {
    headers,
    data: { message: "Create an invoice", history: [] }
  });
  expect(guestBlocked.status()).toBe(401);

  const revoked = await request.post("/api/assistant/consent", {
    headers,
    data: { accepted: false }
  });
  expect(revoked.ok()).toBeTruthy();
  expect((await revoked.json()).accepted).toBe(false);
});
