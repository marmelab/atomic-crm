import path from "node:path";
import { defineConfig } from "vitest/config";

// Separate config for Supabase Edge Function tests.
// These files are written for Deno and use JSR imports (jsr:@supabase/supabase-js@2)
// that Vite cannot resolve. We alias jsr: imports to their npm equivalents so
// Vitest can run the tests in a Node environment without a Deno runtime.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["supabase/functions/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
  },
  resolve: {
    alias: {
      // Map the Deno JSR import to the installed npm package
      "jsr:@supabase/supabase-js@2": path.resolve(
        __dirname,
        "node_modules/@supabase/supabase-js",
      ),
      // Map the Deno npm: specifier for zod to the installed npm package
      // so edge function tests can import the same schemas that run in
      // production without requiring the full Deno runtime.
      "npm:zod@4": path.resolve(__dirname, "node_modules/zod"),
      "npm:pdf-lib@1.17.1": path.resolve(__dirname, "node_modules/pdf-lib"),
    },
  },
});
