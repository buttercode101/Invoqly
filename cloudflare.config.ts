import { bindings, defineConfig, defineWorker } from "cf/config";

const localHyperdriveConnection = process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
const configuredHyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID || "77c8a66ec1b64e1ca0b821f92a8ff235";
if (!configuredHyperdriveId && !localHyperdriveConnection) {
  throw new Error("Set CLOUDFLARE_HYPERDRIVE_ID before deploying Invoqly to Cloudflare.");
}
const hyperdriveId = configuredHyperdriveId || "00000000-0000-0000-0000-000000000000";
// Workers AI has no local workerd simulation; CI exercises auth/consent gates without opening a remote AI session.
const enableWorkersAiBinding = process.env.CI_COMPATIBILITY_RUNTIME !== "true";
const receiptsBucket = process.env.INVOQLY_RECEIPTS_BUCKET || (process.env.INVOQLY_WORKER_NAME === "invoqly-production" ? "invoqly-receipts-prod" : "invoqly-receipts-preview");

export default defineConfig({
  worker: defineWorker({
    name: process.env.INVOQLY_WORKER_NAME || "invoqly-preview",
    entrypoint: "vinext/server/fetch-handler",
    compatibilityDate: "2026-11-10",
    compatibilityFlags: ["nodejs_compat"],
    assets: {
      htmlHandling: "none",
      notFoundHandling: "none",
      runWorkerFirst: ["/*", "!/_next/static/*", "!/*/_next/static/*"]
    },
    env: {
      ASSETS: bindings.assets(),
      R2_RECEIPTS: bindings.r2({ name: receiptsBucket }),
      ...(enableWorkersAiBinding ? { AI: bindings.ai() } : {}),
      BETTER_AUTH_SECRET: bindings.secret(),
      AUTH_EMAIL_VERIFICATION: bindings.text(process.env.AUTH_EMAIL_VERIFICATION || "false"),
      AUTH_RATE_LIMIT_ENABLED: bindings.text(process.env.AUTH_RATE_LIMIT_ENABLED || "true"),
      AUTH_RATE_LIMIT_MAX: bindings.text(process.env.AUTH_RATE_LIMIT_MAX || "10"),
      BETTER_AUTH_URL: bindings.text(process.env.BETTER_AUTH_URL || "https://invoqly-preview.buttercoder-dev.workers.dev"),
      NEXT_PUBLIC_APP_URL: bindings.text(process.env.NEXT_PUBLIC_APP_URL || "https://invoqly-preview.buttercoder-dev.workers.dev"),
      HYPERDRIVE: bindings.hyperdrive({
        id: hyperdriveId,
        dev: { connectionString: localHyperdriveConnection }
      })
    }
  })
});
