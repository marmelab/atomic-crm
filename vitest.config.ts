import path from "node:path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";

export default defineConfig({
  plugins: [react()],
  optimizeDeps: {
    include: [
      "@storybook/react-vite",
      "faker/locale/en",
      "faker/locale/en_US",
      "jsonexport/dist",
      "lodash",
      "papaparse",
      "ra-supabase-language-english",
    ],
    exclude: ["playwright", "playwright-core"],
  },
  test: {
    globals: true,
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
      "src/**/*.integration.test.{ts,tsx}",
      "supabase/**",
      "e2e/**/*.spec.{ts,tsx}",
    ],
    server: {
      deps: {
        external: [/playwright/],
      },
    },
  },
  resolve: {
    preserveSymlinks: true,
    alias: {
      "@": path.resolve(__dirname, "./src"),
    },
  },
});
