#!/usr/bin/env node

import process from "node:process";

import { createClient } from "@supabase/supabase-js";

import {
  getLocalAdminConfig,
  getLocalSupabaseEnv,
} from "./local-admin-config.mjs";

const WAIT_TIMEOUT_MS = 8000;
const WAIT_STEP_MS = 250;

async function waitForSale(adminClient, userId) {
  const startedAt = Date.now();

  while (Date.now() - startedAt < WAIT_TIMEOUT_MS) {
    const response = await adminClient
      .from("sales")
      .select("id, user_id, administrator, disabled")
      .eq("user_id", userId)
      .maybeSingle();

    if (response.error) {
      throw response.error;
    }

    if (response.data) {
      return response.data;
    }

    await new Promise((resolve) => setTimeout(resolve, WAIT_STEP_MS));
  }

  throw new Error("Timeout in attesa della riga sales dell'admin locale.");
}

async function findUserByEmail(adminClient, email) {
  const listed = await adminClient.auth.admin.listUsers({
    page: 1,
    perPage: 200,
  });

  if (listed.error) {
    throw listed.error;
  }

  return (
    listed.data.users.find(
      (user) => user.email?.toLowerCase() === email.toLowerCase(),
    ) ?? null
  );
}

async function main() {
  const supabaseEnv = getLocalSupabaseEnv();

  if (!supabaseEnv.API_URL?.startsWith("http://127.0.0.1:")) {
    throw new Error(
      `Bootstrap admin rifiutato: API locale inattesa (${supabaseEnv.API_URL ?? "missing"}).`,
    );
  }

  if (!supabaseEnv.SERVICE_ROLE_KEY) {
    throw new Error(
      "SERVICE_ROLE_KEY locale non disponibile da `supabase status -o env`.",
    );
  }

  const adminConfig = getLocalAdminConfig();
  const adminClient = createClient(
    supabaseEnv.API_URL,
    supabaseEnv.SERVICE_ROLE_KEY,
  );

  const existingUser = await findUserByEmail(adminClient, adminConfig.email);

  let user = existingUser;
  let mode = "updated";

  if (!user) {
    const created = await adminClient.auth.admin.createUser({
      email: adminConfig.email,
      password: adminConfig.password,
      email_confirm: true,
      user_metadata: {
        first_name: adminConfig.firstName,
        last_name: adminConfig.lastName,
      },
    });

    if (created.error || !created.data.user) {
      throw created.error ?? new Error("Creazione admin locale fallita.");
    }

    user = created.data.user;
    mode = "created";
  } else {
    const updated = await adminClient.auth.admin.updateUserById(user.id, {
      email_confirm: true,
      password: adminConfig.password,
      user_metadata: {
        first_name: adminConfig.firstName,
        last_name: adminConfig.lastName,
      },
    });

    if (updated.error || !updated.data.user) {
      throw updated.error ?? new Error("Aggiornamento admin locale fallito.");
    }

    user = updated.data.user;
  }

  const sale = await waitForSale(adminClient, user.id);
  const ensuredSale = await adminClient
    .from("sales")
    .update({
      first_name: adminConfig.firstName,
      last_name: adminConfig.lastName,
      email: adminConfig.email,
      administrator: true,
      disabled: false,
    })
    .eq("user_id", user.id)
    .select("id, administrator, disabled")
    .single();

  if (ensuredSale.error || !ensuredSale.data) {
    throw ensuredSale.error ?? new Error("Allineamento riga sales fallito.");
  }

  console.log(
    JSON.stringify(
      {
        mode,
        email: adminConfig.email,
        password: adminConfig.password,
        userId: user.id,
        saleId: ensuredSale.data.id ?? sale.id,
        administrator: ensuredSale.data.administrator,
        disabled: ensuredSale.data.disabled,
      },
      null,
      2,
    ),
  );
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : String(error));
  process.exit(1);
});
