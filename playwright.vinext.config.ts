import { defineConfig } from "@playwright/test";

process.env.PLAYWRIGHT_BASE_URL = "http://127.0.0.1:3001";

export default defineConfig({
  testDir: "./e2e",
  fullyParallel: false,
  forbidOnly: Boolean(process.env.CI),
  retries: process.env.CI ? 1 : 0,
  reporter: "line",
  use: {
    baseURL: "http://127.0.0.1:3001",
    trace: "retain-on-failure",
    screenshot: "only-on-failure"
  },
  webServer: {
    command: "npm run start:vinext -- --host 127.0.0.1 --port 3001",
    url: "http://127.0.0.1:3001",
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
    env: {
      PLAYWRIGHT_BASE_URL: "http://127.0.0.1:3001",
      BETTER_AUTH_URL: "http://127.0.0.1:3001",
      NEXT_PUBLIC_APP_URL: "http://127.0.0.1:3001"
    }
  }
});
