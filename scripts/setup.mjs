#!/usr/bin/env zx
import "zx/globals";
import crypto from "crypto";
import { createClient } from "@supabase/supabase-js";
import dotenv from "dotenv";

void (async function () {
  echo`First sign in to your Supabase account`;
  await $`npx supabase login`;

  const defaultPassword = generatePassword();

  const defaultProjectName = "react-admin-crm";
  const projectName =
    (await question(
      `Enter your project name: (defaults to: ${defaultProjectName})`
    )) || defaultProjectName;

  const dbPassword =
    (await question(
      `Enter a password for your database: (defaults to: ${defaultPassword})`
    )) || defaultPassword;

  const defaultRegion = "eu-central-1";
  const region =
    (await question(
      `Enter the region for your database: (defaults to: ${defaultRegion})`
    )) || defaultRegion;

  echo`You have the following organizations:`;
  const organizations = await $`npx supabase orgs list`.quiet();
  echo`${organizations}`;
  const organization =
    await question`Enter the ID of the organization under which to create the project:`;

  echo`\n\nCreating a new project with:`;
  echo`- name: ${projectName}`;
  echo`- DB password: ${dbPassword}`;
  echo`- region: ${region}`;
  echo`- orgId: ${organization}\n\n`;

  const projectResult =
    await $`npx supabase projects create ${projectName} --region ${region} --db-password ${dbPassword} --org-id ${organization}`;
  const projectOutput = projectResult.toString().trim();
  const projectId = projectOutput.match(
    /https:\/\/supabase.com\/dashboard\/project\/([a-zA-Z0-9_-]*)/
  )[1];

  const { anonKey, serviceRoleKey } = await fetchApiKeys(projectId);
  echo`Anon key: ${anonKey}`;
  echo`Service role key: ${serviceRoleKey}`;

  await $`echo VITE_SUPABASE_URL=https://${projectId}.supabase.co >> .env`.quiet();
  await $`echo VITE_SUPABASE_ANON_KEY=${anonKey} >> .env`.quiet();
  await $`echo SUPABASE_SERVICE_ROLE_KEY=${serviceRoleKey} >> .env`.quiet();

  await setup(projectId, dbPassword);

  dotenv.config();
  const defaultUserEmail = 'admin@crm.com';
  const userEmail =
    (await question(
      `Enter an email for your default user: (defaults to: ${defaultUserEmail})`
    )) || defaultUserEmail;
  const defaultUserPassword = generatePassword(12);
  const userPassword =
    (await question(
      `Enter a password for your default user: (defaults to: ${defaultUserPassword})`
    )) || defaultUserPassword;

  const supabase = createClient(
    process.env.VITE_SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data, error } = await supabase.auth.admin.createUser({
    email: userEmail,
    password: userPassword,
    email_confirm: true,
  });

  if (error) {
    console.error(error);
    throw new Error(`Failed to create user ${userEmail}`);
  }

  const { error: errorProfile } = await supabase.from("sales").insert({
    first_name: 'Admin',
    last_name: 'Admin',
    email: userEmail,
    user_id: data.user.id,
  });

  if (errorProfile) {
    console.error(error);
    throw new Error(
      `Failed to create user ${userEmail}: ${errorProfile.message}`
    );
  }
})();

const fetchApiKeys = async (projectId) => {
  let anonKey = "";
  let serviceRoleKey = "";

  try {
    const projectConfig =
      await $`supabase projects api-keys --project-ref ${projectId}`.quiet();

    const keys = projectConfig.stdout
      .trim()
      .match(/[ ]+([a-z_]*)[ ]+│[ ]+([a-zA-Z0-9._-]+)/gm);

    for (const key of keys) {
      const [name, value] = key.split("│").map((s) => s.trim());
      if (name === "anon") {
        anonKey = value;
      }
      if (name === "service_role") {
        serviceRoleKey = value;
      }
    }
  } catch (e) {}

  if (anonKey === "" || serviceRoleKey === "") {
    await sleep(1000);
    return fetchApiKeys(projectId);
  }

  return { anonKey, serviceRoleKey };
};

const setup = async (projectId, dbPassword) => {
  try {
    await $`supabase link --project-ref ${projectId} --password ${dbPassword}`.quiet();
    await $`supabase db push --linked --password ${dbPassword}`.quiet();
  } catch (e) {
    await sleep(1000);
    return setup(projectId, dbPassword);
  }
};

const generatePassword = (length) => {
  const password = crypto
    .getRandomValues(new BigUint64Array(4))
    .reduce(
      (prev, curr, index) =>
        (!index ? prev : prev.toString(36)) +
        (index % 2 ? curr.toString(36).toUpperCase() : curr.toString(36))
    )
    .split("")
    .sort(() => 128 - crypto.getRandomValues(new Uint8Array(1))[0])
    .join("");

  if (length) {
    return password.slice(0, length);
  }

  return password;
};
