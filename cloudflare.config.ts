import { bindings, defineConfig, defineWorker } from "cf/config";

const localHyperdriveConnection = process.env.CLOUDFLARE_HYPERDRIVE_LOCAL_CONNECTION_STRING_HYPERDRIVE;
const configuredHyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID;
if (!configuredHyperdriveId && !localHyperdriveConnection) {
  throw new Error("Set CLOUDFLARE_HYPERDRIVE_ID before deploying Invoqly to Cloudflare.");
}
const hyperdriveId = configuredHyperdriveId || "00000000-0000-0000-0000-000000000000";

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
      HYPERDRIVE: bindings.hyperdrive({ id: hyperdriveId })
    }
  })
});
