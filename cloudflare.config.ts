import { bindings, defineConfig, defineWorker } from "cf/config";

const localHyperdriveConnection = process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
const configuredHyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID || "77c8a66ec1b64e1ca0b821f92a8ff235";
if (!configuredHyperdriveId && !localHyperdriveConnection) {
  throw new Error("Set CLOUDFLARE_HYPERDRIVE_ID before deploying Invoqly to Cloudflare.");
}
const hyperdriveId = configuredHyperdriveId || "00000000-0000-0000-0000-000000000000";

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
      AI: bindings.ai(),
      BETTER_AUTH_SECRET: bindings.secret(),
      AUTH_EMAIL_VERIFICATION: bindings.text(process.env.AUTH_EMAIL_VERIFICATION || "false"),
      BETTER_AUTH_URL: bindings.text(process.env.BETTER_AUTH_URL || "https://invoqly-preview.buttercoder-dev.workers.dev"),
      NEXT_PUBLIC_APP_URL: bindings.text(process.env.NEXT_PUBLIC_APP_URL || "https://invoqly-preview.buttercoder-dev.workers.dev"),
      HYPERDRIVE: bindings.hyperdrive({
        id: hyperdriveId,
        dev: { connectionString: localHyperdriveConnection }
      })
    }
  })
});
