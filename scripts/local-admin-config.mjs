import { execFileSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import process from "node:process";

export const LOCAL_ADMIN_DEFAULTS = {
  email: "admin@gestionale.local",
  password: "LocalAdmin123!",
  firstName: "Rosario",
  lastName: "Admin",
};

function stripWrappingQuotes(value) {
  if (
    (value.startsWith('"') && value.endsWith('"')) ||
    (value.startsWith("'") && value.endsWith("'"))
  ) {
    return value.slice(1, -1);
  }

  return value;
}

export function parseDotEnvFile(path) {
  if (!existsSync(path)) {
    return {};
  }

  const lines = readFileSync(path, "utf8").split("\n");
  const values = {};

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#")) continue;

    const separatorIndex = line.indexOf("=");
    if (separatorIndex === -1) continue;

    const key = line.slice(0, separatorIndex).trim();
    const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
    values[key] = value;
  }

  return values;
}

export function loadProjectEnv() {
  return {
    ...parseDotEnvFile(".env.development"),
    ...parseDotEnvFile(".env.local"),
    ...process.env,
  };
}

function parseShellEnv(raw) {
  return raw
    .split("\n")
    .map((line) => line.trim())
    .filter((line) => line.includes("=") && /^[A-Z0-9_]+=/.test(line))
    .reduce((acc, line) => {
      const separatorIndex = line.indexOf("=");
      const key = line.slice(0, separatorIndex).trim();
      const value = stripWrappingQuotes(line.slice(separatorIndex + 1).trim());
      acc[key] = value;
      return acc;
    }, {});
}

export function getLocalSupabaseEnv() {
  try {
    const raw = execFileSync("npx", ["supabase", "status", "-o", "env"], {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    });
    return parseShellEnv(raw);
  } catch (error) {
    throw new Error(
      "Supabase locale non disponibile. Avvia prima `npx supabase start` o `make start`.",
      { cause: error },
    );
  }
}

export function getLocalAdminConfig(env = loadProjectEnv()) {
  return {
    email: env.LOCAL_SUPABASE_ADMIN_EMAIL ?? LOCAL_ADMIN_DEFAULTS.email,
    password:
      env.LOCAL_SUPABASE_ADMIN_PASSWORD ?? LOCAL_ADMIN_DEFAULTS.password,
    firstName:
      env.LOCAL_SUPABASE_ADMIN_FIRST_NAME ?? LOCAL_ADMIN_DEFAULTS.firstName,
    lastName:
      env.LOCAL_SUPABASE_ADMIN_LAST_NAME ?? LOCAL_ADMIN_DEFAULTS.lastName,
  };
}
