import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

import type { Page } from "@playwright/test";
import { expect } from "@playwright/test";

const adminEmail =
  process.env.LOCAL_SUPABASE_ADMIN_EMAIL ?? "admin@gestionale.local";
const adminPassword =
  process.env.LOCAL_SUPABASE_ADMIN_PASSWORD ?? "LocalAdmin123!";

let localE2eStateReady = false;
const e2eStateDir = join(process.cwd(), "test-results");
const e2eStateMarker = join(e2eStateDir, ".e2e-state-ready.marker");

const resetAndBootstrapLocalState = () => {
  execFileSync("npx", ["supabase", "db", "reset"], {
    stdio: "inherit",
  });
  execFileSync("npm", ["run", "local:admin:bootstrap"], {
    stdio: "inherit",
  });
};

const restartLocalSupabase = () => {
  try {
    execFileSync("npx", ["supabase", "stop"], {
      stdio: "inherit",
    });
  } catch {
    // no-op: stop can fail if stack is already down
  }

  execFileSync("npx", ["supabase", "start"], {
    stdio: "inherit",
  });
};

export const ensureLocalE2eState = () => {
  if (localE2eStateReady || existsSync(e2eStateMarker)) {
    localE2eStateReady = true;
    return;
  }

  let resetSucceeded = false;
  let lastError: unknown = null;

  for (let attempt = 1; attempt <= 3; attempt += 1) {
    try {
      resetAndBootstrapLocalState();
      resetSucceeded = true;
      lastError = null;
      break;
    } catch (error) {
      lastError = error;
      if (attempt < 3) {
        console.warn(
          `[e2e] supabase reset attempt ${attempt} failed, restarting local stack and retrying...`,
        );
        restartLocalSupabase();
      }
    }
  }

  if (!resetSucceeded) {
    throw new Error(
      "[e2e] unable to reset local db deterministically after 3 attempts",
      {
        cause: lastError,
      },
    );
  }

  mkdirSync(e2eStateDir, { recursive: true });
  writeFileSync(e2eStateMarker, new Date().toISOString(), "utf8");

  localE2eStateReady = true;
};

export const loginAsLocalAdmin = async (page: Page) => {
  await page.goto("/");

  await expect(
    page.getByRole("heading", {
      name: "Accedi",
    }),
  ).toBeVisible();

  await page.getByLabel("Email").fill(adminEmail);
  await page.getByLabel("Password").fill(adminPassword);
  await page.getByRole("button", { name: "Accedi" }).click();

  await expect(page.getByRole("link", { name: "Clienti" })).toBeVisible();
};
