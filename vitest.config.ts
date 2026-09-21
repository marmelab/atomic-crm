import path from "node:path";
import { defineConfig } from "vitest/config";
import { playwright } from "@vitest/browser-playwright";
import react from "@vitejs/plugin-react";

// Three test projects (https://vitest.dev/guide/projects.html):
//   - "app":       React/DOM unit tests, run in a real browser (Playwright/Chromium).
//   - "claude":    agent-harness hook tests, plain Node integration tests that spawn
//                  the .claude/hooks/*.mjs hooks as subprocesses. No DOM, no browser.
//   - "functions": Supabase Edge Function tests. Written for Deno with JSR imports;
//                  Node-only here, with the jsr:/npm: specifiers aliased to their
//                  installed npm equivalents. Aliases are scoped to this project.
// Run everything with `npm run test:unit:app`, or a single suite with
// `npm run test:unit:claude` / `npm run test:unit:functions` (neither boots a browser).
export default defineConfig({
  test: {
    projects: [
      {
        plugins: [react()],
        optimizeDeps: {
          exclude: ["playwright", "playwright-core"],
        },
        resolve: {
          preserveSymlinks: true,
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "app",
          globals: true,
          browser: {
            headless: true,
            provider: playwright(),
            enabled: true,
            instances: [
              {
                browser: "chromium",
                ...(process.env.CI && {
                  launch: { channel: "chromium-headless-shell" },
                }),
              },
            ],
            commands: {
              // Uses Chrome DevTools Protocol to override the timezone at runtime,
              // since process.env.TZ has no effect in a real browser environment.
              //
              // The session is deliberately NOT detached. Emulation overrides
              // live for the lifetime of the CDP session that set them, so
              // detaching immediately reverted the timezone before the test
              // could observe it — the command was a no-op that reported
              // success. Every test that "forced" a timezone was in fact
              // running in whatever timezone the machine already had, which
              // is why they passed on a Denver laptop and failed in CI: the
              // forcing was never needed locally and never worked anywhere
              // else. Proven with a probe that read Intl before and after
              // and saw UTC both times.
              //
              // One session per page is kept and reused, so repeated calls
              // do not leak sessions.
              async setTimezone({ context, page }, timezoneId: string) {
                const pageWithSession = page as typeof page & {
                  __timezoneCdpSession?: Awaited<
                    ReturnType<typeof context.newCDPSession>
                  >;
                };
                pageWithSession.__timezoneCdpSession ??=
                  await context.newCDPSession(page);
                await pageWithSession.__timezoneCdpSession.send(
                  "Emulation.setTimezoneOverride",
                  { timezoneId },
                );
              },
            },
          },
          exclude: [
            "**/node_modules/**",
            "doc/**",
            "supabase/**",
            ".supabase-e2e/**",
            "e2e/**/*.spec.{ts,tsx}",
            // Harness hook tests are Node-only (they import node:fs / node:path
            // and spawn subprocesses); they run under the "claude" project below.
            ".claude/**",
            // Historical-import tests are Node-only too: they use node:test,
            // which a browser cannot load. `npm run test:unit:scripts` runs
            // them. Without this they are collected here and fail on import,
            // which is how five of them sat red without running at all.
            "scripts/**",
            // Contract tests are Node-only (they read the repo from disk with
            // node:fs); they run under the "contracts" project below.
            "contracts/**",
          ],
          server: {
            deps: {
              external: [/playwright/],
            },
          },
        },
      },
      {
        test: {
          name: "claude",
          environment: "node",
          include: [".claude/**/*.test.mjs"],
          // These tests spawn `node` subprocesses and do real git/worktree work,
          // so they need more headroom than the default 5s.
          testTimeout: 30000,
          hookTimeout: 30000,
        },
      },
      {
        // Reliability contracts (contracts/): the checked-in inventories and
        // canonical vectors, plus the tests that hold each runtime to them.
        // Node, because they read the repository from disk and execute writers
        // headlessly — no DOM is involved in any of it.
        resolve: {
          alias: {
            "@": path.resolve(__dirname, "./src"),
          },
        },
        test: {
          name: "contracts",
          globals: true,
          environment: "node",
          include: ["contracts/**/*.test.ts"],
          exclude: ["**/node_modules/**", ".supabase-e2e/**"],
        },
      },
      {
        // Map the Deno imports to the installed npm packages so Vitest can run
        // these Deno-targeted tests in Node without a Deno runtime. These aliases
        // only apply to this project.
        resolve: {
          alias: {
            "jsr:@supabase/supabase-js@2": path.resolve(
              __dirname,
              "node_modules/@supabase/supabase-js",
            ),
            "npm:tldts": path.resolve(__dirname, "node_modules/tldts"),
            "npm:pgsql-ast-parser@^12": "pgsql-ast-parser",
          },
        },
        test: {
          name: "functions",
          globals: true,
          environment: "node",
          include: ["supabase/functions/**/*.test.ts"],
          exclude: ["**/node_modules/**", ".supabase-e2e/**"],
        },
      },
    ],
  },
});
