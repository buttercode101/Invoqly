import { readFile, writeFile } from "node:fs/promises";

const hyperdriveId = process.env.CLOUDFLARE_HYPERDRIVE_ID;
if (!hyperdriveId || !/^[a-f0-9]{32}$/.test(hyperdriveId)) {
  throw new Error("Set CLOUDFLARE_HYPERDRIVE_ID to the 32-character ID of the dedicated Invoqly preview Hyperdrive configuration.");
}

const config = JSON.parse(await readFile("wrangler.jsonc", "utf8"));
config.hyperdrive = [{ binding: "HYPERDRIVE", id: hyperdriveId }];
await writeFile("wrangler.deploy.jsonc", JSON.stringify(config, null, 2) + "\n");
console.log("Generated isolated preview Worker config with HYPERDRIVE binding.");
