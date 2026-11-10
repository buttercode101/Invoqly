import { bindings, defineConfig, defineWorker } from "cf/config";

const hyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID || "00000000-0000-0000-0000-000000000000";

export default defineConfig({
  accountId: "90cefa028781f749f5816c5748f04cd2",
  worker: defineWorker({
    name: "invoqly-preview",
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
      HYPERDRIVE: bindings.hyperdrive({
        id: hyperdriveId,
        localConnectionString: process.env.DATABASE_URL
      })
    }
  })
});
