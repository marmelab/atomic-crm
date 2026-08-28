#!/usr/bin/env node
/**
 * Local W0 HTTP BFF. Sets app.tenant_id from a stub principal header.
 * Acorn isolation value is the customer id string; RLS uses tenants.id (UUID).
 */
import http from "node:http";
import pg from "pg";

const PORT = Number(process.env.CRM_BFF_PORT || 8787);
const DATABASE_URL =
  process.env.CRM_DATABASE_URL ||
  "postgres://crm_app:crm_app@127.0.0.1:5433/ardley_crm";

const TENANTS = {
  "100004": {
    customerId: "100004",
    slug: "woodley",
    tenantUuid: "4b51bd26-ea4f-5777-b9d9-780dbb91853e",
    userId: "11111111-1111-1111-1111-111111111111",
    email: "woodley.lo@example.test",
    fullName: "Woodley LO",
  },
  "100081": {
    customerId: "100081",
    slug: "envoy",
    tenantUuid: "28dd4130-fe59-5ada-a3ce-78c82259e9dd",
    userId: "22222222-2222-2222-2222-222222222222",
    email: "envoy.lo@example.test",
    fullName: "Envoy LO",
  },
};

const pool = new pg.Pool({ connectionString: DATABASE_URL });

function json(res, status, body) {
  const payload = JSON.stringify(body);
  res.writeHead(status, {
    "content-type": "application/json",
    "access-control-allow-origin": "*",
    "access-control-allow-headers":
      "content-type, x-ardley-customer-id, x-acorn-tenant-id",
    "access-control-allow-methods": "GET,OPTIONS",
  });
  res.end(payload);
}

function principalFrom(req) {
  const raw =
    req.headers["x-ardley-customer-id"] ||
    req.headers["x-acorn-tenant-id"] ||
    "100004";
  const customerId = String(raw).trim();
  return TENANTS[customerId] ?? null;
}

async function withTenant(principal, fn) {
  const client = await pool.connect();
  try {
    await client.query("begin");
    await client.query("select set_config('app.tenant_id', $1, true)", [
      principal.tenantUuid,
    ]);
    const result = await fn(client);
    await client.query("commit");
    return result;
  } catch (err) {
    try {
      await client.query("rollback");
    } catch {
      /* ignore */
    }
    throw err;
  } finally {
    client.release();
  }
}

const server = http.createServer(async (req, res) => {
  if (req.method === "OPTIONS") {
    json(res, 204, {});
    return;
  }

  const url = new URL(req.url || "/", `http://127.0.0.1:${PORT}`);
  const principal = principalFrom(req);
  if (!principal) {
    json(res, 403, { error: "unknown_principal" });
    return;
  }

  try {
    if (req.method === "GET" && url.pathname === "/health") {
      json(res, 200, { ok: true });
      return;
    }

    if (req.method === "GET" && url.pathname === "/me") {
      json(res, 200, {
        customerId: principal.customerId,
        tenantId: principal.customerId,
        tenantUuid: principal.tenantUuid,
        ownerId: principal.userId,
        email: principal.email,
        fullName: principal.fullName,
      });
      return;
    }

    if (req.method === "GET" && url.pathname === "/contacts") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, first_name, last_name, owner_id, tenant_id
           from contacts
           order by last_name, first_name`,
        ),
      );
      json(res, 200, { data: rows.rows, total: rows.rowCount });
      return;
    }

    json(res, 404, { error: "not_found" });
  } catch (err) {
    json(res, 500, { error: String(err?.message || err) });
  }
});

server.listen(PORT, "127.0.0.1", () => {
  process.stdout.write(`local-bff listening on http://127.0.0.1:${PORT}\n`);
});
