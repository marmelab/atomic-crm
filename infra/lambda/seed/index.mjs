import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { Client } from "pg";
import { readFileSync } from "node:fs";
import { join } from "node:path";

const secrets = new SecretsManagerClient({});

function splitSql(sql) {
  const statements = [];
  let current = "";
  let inDollar = false;
  for (const line of sql.split("\n")) {
    const trimmed = line.trim();
    if (trimmed.startsWith("--") && !inDollar) {
      continue;
    }
    if (trimmed.includes("$$")) {
      inDollar = !inDollar;
    }
    current += `${line}\n`;
    if (!inDollar && trimmed.endsWith(";")) {
      const stmt = current.trim();
      if (stmt.length) statements.push(stmt);
      current = "";
    }
  }
  const leftover = current.trim();
  if (leftover.length) statements.push(leftover);
  return statements;
}

async function connectAs(secretArn, overrides = {}) {
  const secret = await secrets.send(
    new GetSecretValueCommand({ SecretId: secretArn }),
  );
  const creds = JSON.parse(secret.SecretString);
  const client = new Client({
    host: creds.host,
    port: creds.port || 5432,
    user: overrides.user || creds.username,
    password: overrides.password || creds.password,
    database: overrides.database || creds.dbname || "ardley_crm",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
  return client;
}

function isBenignAlreadyExists(err) {
  const code = err?.code;
  const message = String(err?.message || "");
  if (code === "42P07") return true; // duplicate_table
  if (code === "42710") return true; // duplicate_object
  if (code === "42723") return true; // duplicate_function
  if (code === "42701") return true; // duplicate_column
  if (/already exists/i.test(message)) return true;
  return false;
}

async function runFile(client, name) {
  const sql = readFileSync(join("/var/task/sql", name), "utf8");
  for (const statement of splitSql(sql)) {
    try {
      await client.query(statement);
    } catch (err) {
      if (isBenignAlreadyExists(err)) continue;
      throw err;
    }
  }
}

export async function handler() {
  const secretArn = process.env.DB_SECRET_ARN;
  if (!secretArn) {
    throw new Error("DB_SECRET_ARN is required");
  }

  const admin = await connectAs(secretArn);
  try {
    await admin.query("create extension if not exists pgcrypto");
    await admin.query("create extension if not exists citext");
    await admin.query('create extension if not exists "uuid-ossp"');
    await runFile(admin, "schema-direction.sql");
    await runFile(admin, "seed_w0.sql");
    await runFile(admin, "seed_w1.sql");
    await runFile(admin, "seed_w3.sql");
    await runFile(admin, "seed_w3_roster.sql");
    await admin.query(`
      do $$
      begin
        if not exists (select 1 from pg_roles where rolname = 'crm_app') then
          create role crm_app login password 'crm_app';
        end if;
      end
      $$;
    `);
    await admin.query("grant connect on database ardley_crm to crm_app");
    await admin.query("grant usage on schema public to crm_app");
    await admin.query(
      "grant select, insert, update, delete on all tables in schema public to crm_app",
    );
    await admin.query(
      "grant usage, select on all sequences in schema public to crm_app",
    );
  } finally {
    await admin.end();
  }

  return { ok: true, seeded: true };
}
