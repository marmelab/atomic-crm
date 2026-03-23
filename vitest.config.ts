import path from "node:path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  test: {
    globals: true,
    setupFiles: ["./src/test/setup.ts"],
    browser: {
      provider: playwright(),
      enabled: true,
      instances: [{ browser: "chromium" }],
      commands: {
        // Uses Chrome DevTools Protocol to override the timezone at runtime,
        // since process.env.TZ has no effect in a real browser environment.
        async setTimezone({ context, page }, timezoneId: string) {
          const session = await context.newCDPSession(page);
          await session.send("Emulation.setTimezoneOverride", { timezoneId });
          await session.detach();
        },
      },
    },
    exclude: [
      "**/node_modules/**",
      "doc/**",
      "supabase/**",
      "e2e/**/*.spec.{ts,tsx}",
    ],
    server: {
      deps: {
        external: [/playwright/],
      },
    },
  },
  optimizeDeps: {
    exclude: ["playwright", "playwright-core"],
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
