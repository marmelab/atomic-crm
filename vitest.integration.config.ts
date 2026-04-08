import path from "node:path";
import { defineConfig } from "vitest/config";
import dotenv from "dotenv";

dotenv.config({ path: path.resolve(__dirname, ".env.e2e") });

// Integration tests run against a real Supabase instance (local or remote).
// Requires local Supabase running or appropriate env vars set.
export default defineConfig({
  test: {
    globals: true,
    environment: "node",
    include: ["src/test/integration/**/*.test.ts"],
    exclude: ["**/node_modules/**"],
    testTimeout: 30_000,
    hookTimeout: 30_000,
    sequence: { concurrent: false },
  },
  resolve: {
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
