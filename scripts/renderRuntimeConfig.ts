// Renders the app's config.js from the VITE_* environment variables. The Vite
// plugin below serves it in dev and writes it in builds; deployments overwrite
// it with:
//
//   node scripts/renderRuntimeConfig.ts dist/config.js
//
// See src/components/atomic-crm/root/config.ts for how the app reads it.

import { writeFileSync } from "node:fs";
import type { Plugin } from "vite";

type Env = Record<string, string | undefined>;

// Written to config.js, which is public: never add a secret here.
const ENV_KEYS = {
  supabaseUrl: "VITE_SUPABASE_URL",
  supabasePublishableKey: "VITE_SB_PUBLISHABLE_KEY",
  isDemo: "VITE_IS_DEMO",
  inboundEmail: "VITE_INBOUND_EMAIL",
  attachmentsBucket: "VITE_ATTACHMENTS_BUCKET",
  googleWorkplaceDomain: "VITE_GOOGLE_WORKPLACE_DOMAIN",
  disableEmailPasswordAuthentication:
    "VITE_DISABLE_EMAIL_PASSWORD_AUTHENTICATION",
};

const BOOLEAN_KEYS = ["isDemo", "disableEmailPasswordAuthentication"];

export const renderRuntimeConfig = (env: Env): string => {
  const config = Object.fromEntries(
    Object.entries(ENV_KEYS)
      // An unset CI variable comes through as "": treat it as unset.
      .filter(([, envName]) => env[envName])
      .map(([key, envName]) => [
        key,
        BOOLEAN_KEYS.includes(key) ? env[envName] === "true" : env[envName],
      ]),
  );
  return `window._atomicCrmConfig = ${JSON.stringify(config, null, 2)};\n`;
};

export const runtimeConfig = (): Plugin => {
  let script = "";
  return {
    name: "runtime-config",
    configResolved: (config) => {
      script = renderRuntimeConfig(config.env);
    },
    configureServer: (server) => {
      server.middlewares.use("/config.js", (_req, res) => {
        res.setHeader("Content-Type", "text/javascript");
        res.end(script);
      });
    },
    generateBundle() {
      this.emitFile({ type: "asset", fileName: "config.js", source: script });
    },
  };
};

if (import.meta.main) {
  const [outFile = "dist/config.js"] = process.argv.slice(2);
  writeFileSync(outFile, renderRuntimeConfig(process.env));
  // eslint-disable-next-line no-console
  console.log(`Wrote ${outFile}`);
}
