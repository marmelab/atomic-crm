#!/usr/bin/env node

import { execFileSync } from "node:child_process";
import process from "node:process";

import { createClient } from "@supabase/supabase-js";
import { getLocalSupabaseEnv, parseDotEnvFile } from "./local-admin-config.mjs";

const DEFAULT_PROJECT_REF = "qvdmzhyzpyaveniirsmo";
const DEFAULT_PASSWORD = "CodexSmoke123!";
const DEFAULT_TIMEOUT_MS = 8000;
const DEFAULT_POLL_MS = 300;

function loadRemoteEnv() {
  const loaded = {
    ...parseDotEnvFile(".env.production"),
    ...process.env,
  };

  return {
    target: "remote",
    supabaseUrl: loaded.VITE_SUPABASE_URL,
    publishableKey: loaded.VITE_SB_PUBLISHABLE_KEY,
    projectRef: loaded.SUPABASE_PROJECT_REF ?? DEFAULT_PROJECT_REF,
    serviceRoleKey: undefined,
  };
}

function loadLocalEnv() {
  const loaded = getLocalSupabaseEnv();

  return {
    target: "local",
    supabaseUrl: loaded.API_URL,
    publishableKey: loaded.PUBLISHABLE_KEY,
    projectRef: "local",
    serviceRoleKey: loaded.SERVICE_ROLE_KEY,
  };
}

function getServiceRoleKey(projectRef) {
  const raw = execFileSync(
    "npx",
    [
      "supabase",
      "projects",
      "api-keys",
      "--project-ref",
      projectRef,
      "-o",
      "json",
    ],
    {
      encoding: "utf8",
      stdio: ["ignore", "pipe", "inherit"],
    },
  );

  const keys = JSON.parse(raw);
  const serviceRoleKey = keys.find((row) => row.id === "service_role")?.api_key;

  if (!serviceRoleKey) {
    throw new Error("Chiave service_role non trovata via Supabase CLI.");
  }

  return serviceRoleKey;
}

function getArgValue(flag) {
  const index = process.argv.indexOf(flag);
  if (index === -1) return undefined;
  return process.argv[index + 1];
}

function getMode() {
  return process.argv[2] ?? "create";
}

function getTarget() {
  return getArgValue("--target") ?? process.env.SMOKE_TARGET ?? "remote";
}

function buildEmail() {
  const stamp = Date.now();
  return `codexsmoke${stamp}@gmail.com`;
}

async function waitForSale(adminClient, userId, timeoutMs) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < timeoutMs) {
    const response = await adminClient
      .from("sales")
      .select("id, user_id, email")
      .eq("user_id", userId)
      .maybeSingle();

    if (response.error) {
      throw response.error;
    }

    if (response.data) {
      return response.data;
    }

    await new Promise((resolve) => setTimeout(resolve, DEFAULT_POLL_MS));
  }

  throw new Error("Timeout in attesa della riga sales per l'utente smoke.");
}

async function createSmokeUser() {
  const env = getTarget() === "local" ? loadLocalEnv() : loadRemoteEnv();
  const { supabaseUrl, publishableKey, projectRef } = env;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Mancano VITE_SUPABASE_URL o VITE_SB_PUBLISHABLE_KEY negli env del repo.",
    );
  }

  const serviceRoleKey = env.serviceRoleKey ?? getServiceRoleKey(projectRef);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);
  const browserClient = createClient(supabaseUrl, publishableKey);

  const email = getArgValue("--email") ?? buildEmail();
  const password = getArgValue("--password") ?? DEFAULT_PASSWORD;
  const timeoutMs = Number(getArgValue("--timeout-ms") ?? DEFAULT_TIMEOUT_MS);

  const created = await adminClient.auth.admin.createUser({
    email,
    password,
    email_confirm: true,
    user_metadata: {
      first_name: "Codex",
      last_name: "Smoke",
    },
  });

  if (created.error || !created.data.user) {
    throw created.error ?? new Error("Creazione utente smoke fallita.");
  }

  const userId = created.data.user.id;
  const sale = await waitForSale(adminClient, userId, timeoutMs);

  const login = await browserClient.auth.signInWithPassword({
    email,
    password,
  });

  if (login.error || !login.data.session) {
    throw login.error ?? new Error("Login smoke fallito.");
  }

  console.log(
    JSON.stringify(
      {
        email,
        password,
        userId,
        saleId: sale.id,
        projectRef,
        target: env.target,
      },
      null,
      2,
    ),
  );
}

async function cleanupSmokeUser() {
  const env = getTarget() === "local" ? loadLocalEnv() : loadRemoteEnv();
  const { supabaseUrl, publishableKey, projectRef } = env;

  if (!supabaseUrl || !publishableKey) {
    throw new Error(
      "Mancano VITE_SUPABASE_URL o VITE_SB_PUBLISHABLE_KEY negli env del repo.",
    );
  }

  const userId = getArgValue("--user-id");
  const email = getArgValue("--email");

  if (!userId && !email) {
    throw new Error("Per cleanup serve --user-id oppure --email.");
  }

  const serviceRoleKey = env.serviceRoleKey ?? getServiceRoleKey(projectRef);
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  let resolvedUserId = userId;

  if (!resolvedUserId && email) {
    const users = await adminClient.auth.admin.listUsers();
    if (users.error) {
      throw users.error;
    }

    resolvedUserId =
      users.data.users.find((user) => user.email === email)?.id ?? undefined;
  }

  if (!resolvedUserId) {
    throw new Error("Utente smoke non trovato per cleanup.");
  }

  const deletedSales = await adminClient
    .from("sales")
    .delete()
    .eq("user_id", resolvedUserId);

  if (deletedSales.error) {
    throw deletedSales.error;
  }

  const deletedUser = await adminClient.auth.admin.deleteUser(resolvedUserId);

  if (deletedUser.error) {
    throw deletedUser.error;
  }

  console.log(
    JSON.stringify(
      {
        userId: resolvedUserId,
        cleaned: true,
        projectRef,
        target: env.target,
      },
      null,
      2,
    ),
  );
}

async function main() {
  const mode = getMode();

  if (mode === "create") {
    await createSmokeUser();
    return;
  }

  if (mode === "cleanup") {
    await cleanupSmokeUser();
    return;
  }

  throw new Error(`Modalita non supportata: ${mode}`);
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
