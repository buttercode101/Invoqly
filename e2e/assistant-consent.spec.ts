import { expect, test } from "@playwright/test";

test("AI co-pilot requires explicit consent and an authenticated account", async ({ page }) => {
  await page.goto("/");
  const initial = await page.evaluate(async () => (await fetch("/api/assistant/consent")).json() as Promise<{ accepted: boolean }>);
  expect(initial.accepted).toBe(false);

  const blocked = await page.evaluate(async () => {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Create an invoice", history: [] })
    });
    return { status: response.status, body: await response.json() };
  });
  expect(blocked.status).toBe(428);

  const accepted = await page.evaluate(async () => {
    const response = await fetch("/api/assistant/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: true })
    });
    return { status: response.status, body: await response.json() as { accepted: boolean } };
  });
  expect(accepted.status).toBe(200);
  expect(accepted.body.accepted).toBe(true);

  const enabled = await page.evaluate(async () => (await fetch("/api/assistant/consent")).json() as Promise<{ accepted: boolean }>);
  expect(enabled.accepted).toBe(true);

  const guestBlocked = await page.evaluate(async () => {
    const response = await fetch("/api/assistant", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ message: "Create an invoice", history: [] })
    });
    return { status: response.status, body: await response.json() };
  });
  expect(guestBlocked.status).toBe(401);

  const revoked = await page.evaluate(async () => {
    const response = await fetch("/api/assistant/consent", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ accepted: false })
    });
    return { status: response.status, body: await response.json() as { accepted: boolean } };
  });
  expect(revoked.status).toBe(200);
  expect(revoked.body.accepted).toBe(false);
});
