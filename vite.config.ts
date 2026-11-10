import { fileURLToPath } from "node:url";
import { defineConfig } from "vite";
import vinext from "vinext";
import { cloudflare } from "@cloudflare/vite-plugin";

const cloudflareDatabaseAdapter = fileURLToPath(
  new URL("./src/lib/db/connection.cloudflare.ts", import.meta.url)
);

export default defineConfig({
  resolve: {
    alias: [{
      find: "@/lib/db/connection",
      replacement: cloudflareDatabaseAdapter
    }]
  },
  plugins: [
    vinext(),
    cloudflare({ viteEnvironment: { name: "rsc", childEnvironments: ["ssr"] } })
  ]
});
