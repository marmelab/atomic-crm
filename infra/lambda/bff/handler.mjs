import { SecretsManagerClient, GetSecretValueCommand } from "@aws-sdk/client-secrets-manager";
import { createPublicKey, createVerify } from "node:crypto";
import { Client } from "pg";

const secrets = new SecretsManagerClient({});
const TENANTS = {
  "100004": {
    customerId: "100004",
    slug: "woodley",
    tenantUuid: "4b51bd26-ea4f-5777-b9d9-780dbb91853e",
  },
  "100081": {
    customerId: "100081",
    slug: "envoy",
    tenantUuid: "28dd4130-fe59-5ada-a3ce-78c82259e9dd",
  },
};

const jwksCache = { keys: null, fetchedAt: 0 };
let dbSecret;

function json(status, body, extraHeaders = {}) {
  return {
    statusCode: status,
    headers: {
      "content-type": "application/json",
      "access-control-allow-origin": process.env.SPA_ORIGIN || "https://crm.dev.ardley.us",
      "access-control-allow-headers": "content-type, authorization",
      "access-control-allow-methods": "GET,PATCH,POST,OPTIONS",
      ...extraHeaders,
    },
    body: JSON.stringify(body),
  };
}

function decodeSegment(segment) {
  return Buffer.from(segment.replace(/-/g, "+").replace(/_/g, "/"), "base64");
}

function decodeJwtPart(segment) {
  return JSON.parse(decodeSegment(segment).toString("utf8"));
}

async function getJwks() {
  const now = Date.now();
  if (jwksCache.keys && now - jwksCache.fetchedAt < 3600_000) {
    return jwksCache.keys;
  }
  const issuer = process.env.COGNITO_ISSUER;
  const res = await fetch(`${issuer}/.well-known/jwks.json`);
  if (!res.ok) {
    throw new Error(`jwks_fetch_failed ${res.status}`);
  }
  const body = await res.json();
  jwksCache.keys = body.keys;
  jwksCache.fetchedAt = now;
  return jwksCache.keys;
}

function jwkToPem(jwk) {
  return createPublicKey({ key: jwk, format: "jwk" });
}

async function verifyJwt(token) {
  const [headerB64, payloadB64, signatureB64] = token.split(".");
  if (!headerB64 || !payloadB64 || !signatureB64) {
    throw new Error("malformed_token");
  }
  const header = decodeJwtPart(headerB64);
  const payload = decodeJwtPart(payloadB64);
  const issuer = process.env.COGNITO_ISSUER;
  const clientId = process.env.COGNITO_CLIENT_ID;
  if (payload.iss !== issuer) throw new Error("bad_issuer");
  if (payload.token_use !== "id" && payload.token_use !== "access") {
    throw new Error("bad_token_use");
  }
  if (payload.aud && payload.aud !== clientId && payload.client_id !== clientId) {
    throw new Error("bad_audience");
  }
  if ((payload.exp || 0) * 1000 < Date.now() - 30_000) {
    throw new Error("expired");
  }
  const keys = await getJwks();
  const jwk = keys.find((key) => key.kid === header.kid);
  if (!jwk) throw new Error("unknown_kid");
  const verifier = createVerify("RSA-SHA256");
  verifier.update(`${headerB64}.${payloadB64}`);
  verifier.end();
  const ok = verifier.verify(jwkToPem(jwk), decodeSegment(signatureB64));
  if (!ok) throw new Error("bad_signature");
  return payload;
}

function customerIdFromClaims(claims) {
  const fromClaim =
    claims["custom:customerId"] ||
    claims["custom:tenantId"] ||
    claims.customerId;
  if (fromClaim && TENANTS[String(fromClaim)]) return String(fromClaim);
  return null;
}

async function getDbSecret() {
  if (dbSecret) return dbSecret;
  const secret = await secrets.send(
    new GetSecretValueCommand({ SecretId: process.env.DB_SECRET_ARN }),
  );
  dbSecret = JSON.parse(secret.SecretString);
  return dbSecret;
}

async function withTenant(principal, fn) {
  const creds = await getDbSecret();
  const client = new Client({
    host: creds.host,
    port: creds.port || 5432,
    user: "crm_app",
    password: "crm_app",
    database: creds.dbname || "ardley_crm",
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();
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
    await client.end();
  }
}

async function upsertCrmUser(principal, claims) {
  const email = claims.email || null;
  const sub = claims.sub;
  await withTenant(principal, async (client) => {
    const existing = await client.query(
      `select id from crm_users where cognito_sub = $1`,
      [sub],
    );
    if (existing.rowCount) {
      principal.userId = existing.rows[0].id;
      if (email) {
        await client.query(`update crm_users set email = $2 where id = $1`, [
          principal.userId,
          email,
        ]);
      }
      return;
    }
    const inserted = await client.query(
      `insert into crm_users (tenant_id, cognito_sub, email)
       values ($1, $2, $3)
       on conflict (cognito_sub) do update set email = excluded.email
       returning id`,
      [principal.tenantUuid, sub, email],
    );
    principal.userId = inserted.rows[0].id;
  });
}

async function resolveSavedView(client, view) {
  const query = view.query || {};
  const kind = query.kind;
  if (kind === "contacts_by_type") {
    const rows = await client.query(
      `select c.id, c.first_name, c.last_name
       from contacts c
       join contact_type_assignments t on t.contact_id = c.id
       where t.type_id = $1 and c.merged_into_id is null
       order by c.last_name, c.first_name`,
      [query.type_id],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      label: `${row.first_name} ${row.last_name}`,
      href: `/contacts/${row.id}/show`,
    }));
  }
  if (kind === "list") {
    const rows = await client.query(
      `select c.id, c.first_name, c.last_name
       from list_members m
       join contacts c on c.id = m.object_id
       where m.list_id = $1 and m.object_type = 'contact'
         and c.merged_into_id is null
       order by c.last_name, c.first_name`,
      [query.list_id],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      label: `${row.first_name} ${row.last_name}`,
      href: `/contacts/${row.id}/show`,
    }));
  }
  if (kind === "deals_by_pipeline") {
    const rows = await client.query(
      `select d.id, d.name, s.label as stage_label
       from deals d
       join pipeline_stages s on s.id = d.stage_id
       where d.pipeline_id = $1
       order by d.name`,
      [query.pipeline_id],
    );
    return rows.rows.map((row) => ({
      id: row.id,
      label: row.stage_label ? `${row.name} · ${row.stage_label}` : row.name,
      href: `/deals/${row.id}/show`,
    }));
  }
  return [];
}

function parseBody(event) {
  if (!event.body) return {};
  const raw = event.isBase64Encoded
    ? Buffer.from(event.body, "base64").toString("utf8")
    : event.body;
  return JSON.parse(raw);
}

function header(event, name) {
  const headers = event.headers || {};
  const found = Object.entries(headers).find(
    ([key]) => key.toLowerCase() === name.toLowerCase(),
  );
  return found ? found[1] : undefined;
}

function bearerToken(event) {
  const value = header(event, "authorization") || "";
  if (!value.toLowerCase().startsWith("bearer ")) return null;
  return value.slice(7).trim();
}

export async function handler(event) {
  const method =
    event.requestContext?.http?.method || event.httpMethod || "GET";
  const rawPath = event.rawPath || event.path || "/";
  const qs = event.queryStringParameters || {};

  if (method === "OPTIONS") {
    return json(204, {});
  }
  if (method === "GET" && rawPath === "/health") {
    return json(200, { ok: true, service: "ardley-crm", env: "dev" });
  }

  try {
    const token = bearerToken(event);
    if (!token) return json(401, { error: "missing_token" });
    const claims = await verifyJwt(token);
    const customerId = customerIdFromClaims(claims);
    if (!customerId) return json(403, { error: "unknown_principal" });
    const principal = {
      ...TENANTS[customerId],
      email: claims.email || null,
      fullName:
        [claims.given_name, claims.family_name].filter(Boolean).join(" ") ||
        claims.email ||
        claims.sub,
      cognitoSub: claims.sub,
      userId: null,
    };
    await upsertCrmUser(principal, claims);

    if (method === "GET" && rawPath === "/me") {
      return json(200, {
        customerId: principal.customerId,
        tenantId: principal.customerId,
        tenantUuid: principal.tenantUuid,
        ownerId: principal.userId,
        email: principal.email,
        fullName: principal.fullName,
      });
    }

    if (method === "GET" && rawPath === "/contacts") {
      const q = qs.q || null;
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select c.id, c.first_name, c.last_name, c.owner_id, c.tenant_id,
                  c.merged_into_id,
                  (
                    select t.type_id
                    from contact_type_assignments t
                    where t.contact_id = c.id
                    order by t.is_primary desc, t.type_id
                    limit 1
                  ) as primary_type
           from contacts c
           where c.merged_into_id is null
             and (
               $1::text is null
               or c.first_name ilike '%' || $1 || '%'
               or c.last_name ilike '%' || $1 || '%'
               or exists (
                 select 1 from contact_identifiers i
                 where i.contact_id = c.id and i.value ilike '%' || $1 || '%'
               )
             )
           order by c.last_name, c.first_name`,
          [q],
        ),
      );
      return json(200, { data: rows.rows, total: rows.rowCount });
    }

    if (method === "POST" && rawPath === "/contacts/merge") {
      const body = parseBody(event);
      const loserId = body?.loser_id;
      const winnerId = body?.winner_id;
      if (!loserId || !winnerId || loserId === winnerId) {
        return json(400, { error: "loser_id_and_winner_id_required" });
      }
      const merged = await withTenant(principal, async (client) => {
        const found = await client.query(
          `select id, merged_into_id from contacts where id in ($1, $2)`,
          [loserId, winnerId],
        );
        if (found.rowCount !== 2) return null;
        if (found.rows.some((row) => row.merged_into_id)) {
          throw new Error("already_merged");
        }
        await client.query(
          `update contact_identifiers set contact_id = $2
           where contact_id = $1
             and not exists (
               select 1 from contact_identifiers w
               where w.contact_id = $2
                 and w.id_type = contact_identifiers.id_type
                 and w.value = contact_identifiers.value
             )`,
          [loserId, winnerId],
        );
        await client.query(
          `delete from contact_identifiers where contact_id = $1`,
          [loserId],
        );
        await client.query(
          `insert into contact_type_assignments (tenant_id, contact_id, type_id, is_primary)
           select tenant_id, $2, type_id, false
           from contact_type_assignments
           where contact_id = $1
           on conflict do nothing`,
          [loserId, winnerId],
        );
        await client.query(
          `delete from contact_type_assignments where contact_id = $1`,
          [loserId],
        );
        await client.query(
          `update contact_affiliations set contact_id = $2 where contact_id = $1`,
          [loserId, winnerId],
        );
        await client.query(
          `update deal_parties set contact_id = $2
           where contact_id = $1
             and not exists (
               select 1 from deal_parties w
               where w.deal_id = deal_parties.deal_id
                 and w.contact_id = $2
                 and w.role = deal_parties.role
             )`,
          [loserId, winnerId],
        );
        await client.query(`delete from deal_parties where contact_id = $1`, [
          loserId,
        ]);
        await client.query(
          `update record_links set from_id = $2
           where from_object_type = 'contact' and from_id = $1`,
          [loserId, winnerId],
        );
        await client.query(
          `update record_links set to_id = $2
           where to_object_type = 'contact' and to_id = $1`,
          [loserId, winnerId],
        );
        await client.query(
          `update contacts set merged_into_id = $2 where id = $1`,
          [loserId, winnerId],
        );
        return { loser_id: loserId, winner_id: winnerId };
      });
      if (!merged) return json(404, { error: "not_found" });
      return json(200, { data: merged });
    }

    if (method === "GET" && rawPath === "/saved-views") {
      const rows = await withTenant(principal, async (client) => {
        const views = await client.query(
          `select id, name, object_type, query
           from saved_views
           order by name`,
        );
        const data = [];
        for (const view of views.rows) {
          const results = await resolveSavedView(client, view);
          data.push({ ...view, results, result_count: results.length });
        }
        return data;
      });
      return json(200, { data: rows, total: rows.length });
    }

    if (method === "GET" && rawPath === "/companies") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, name, kind_id, parent_company_id, owner_id, tenant_id
           from companies
           order by name`,
        ),
      );
      return json(200, { data: rows.rows, total: rows.rowCount });
    }

    if (method === "GET" && rawPath === "/deals") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, name, pipeline_id, stage_id, amount_cents, owner_id, tenant_id
           from deals
           order by name`,
        ),
      );
      return json(200, { data: rows.rows, total: rows.rowCount });
    }

    const contactOne = rawPath.match(/^\/contacts\/([0-9a-f-]{36})$/i);
    if (method === "GET" && contactOne) {
      const id = contactOne[1];
      const payload = await withTenant(principal, async (client) => {
        const contact = await client.query(
          `select id, first_name, last_name, owner_id, tenant_id, merged_into_id
           from contacts where id = $1`,
          [id],
        );
        if (!contact.rowCount) return null;
        const [types, identifiers, affiliations, links, parties] =
          await Promise.all([
            client.query(
              `select type_id, is_primary from contact_type_assignments
               where contact_id = $1 order by is_primary desc, type_id`,
              [id],
            ),
            client.query(
              `select id, id_type, value from contact_identifiers
               where contact_id = $1 order by id_type`,
              [id],
            ),
            client.query(
              `select a.id, a.company_id, a.role, a.is_primary, c.name as company_name,
                      c.parent_company_id, p.name as parent_company_name
               from contact_affiliations a
               join companies c on c.id = a.company_id
               left join companies p on p.id = c.parent_company_id
               where a.contact_id = $1`,
              [id],
            ),
            client.query(
              `select rl.id, rl.link_type_id, rl.from_object_type, rl.from_id,
                      rl.to_object_type, rl.to_id,
                      concat_ws(' ', fc.first_name, fc.last_name) as from_name,
                      concat_ws(' ', tc.first_name, tc.last_name) as to_name
               from record_links rl
               left join contacts fc
                 on rl.from_object_type = 'contact' and fc.id = rl.from_id
               left join contacts tc
                 on rl.to_object_type = 'contact' and tc.id = rl.to_id
               where (rl.from_object_type = 'contact' and rl.from_id = $1)
                  or (rl.to_object_type = 'contact' and rl.to_id = $1)`,
              [id],
            ),
            client.query(
              `select dp.deal_id, dp.role, dp.is_primary, d.name as deal_name,
                      d.pipeline_id, d.stage_id
               from deal_parties dp
               join deals d on d.id = dp.deal_id
               where dp.contact_id = $1`,
              [id],
            ),
          ]);
        return {
          ...contact.rows[0],
          types: types.rows,
          identifiers: identifiers.rows,
          affiliations: affiliations.rows,
          links: links.rows,
          deals: parties.rows,
        };
      });
      if (!payload) return json(404, { error: "not_found" });
      return json(200, { data: payload });
    }

    const companyOne = rawPath.match(/^\/companies\/([0-9a-f-]{36})$/i);
    if (method === "GET" && companyOne) {
      const id = companyOne[1];
      const payload = await withTenant(principal, async (client) => {
        const company = await client.query(
          `select id, name, kind_id, parent_company_id, owner_id, tenant_id
           from companies where id = $1`,
          [id],
        );
        if (!company.rowCount) return null;
        const [parent, children, people] = await Promise.all([
          company.rows[0].parent_company_id
            ? client.query(
                `select id, name, kind_id from companies where id = $1`,
                [company.rows[0].parent_company_id],
              )
            : Promise.resolve({ rows: [] }),
          client.query(
            `select id, name, kind_id from companies
             where parent_company_id = $1 order by name`,
            [id],
          ),
          client.query(
            `select a.contact_id, a.role, c.first_name, c.last_name
             from contact_affiliations a
             join contacts c on c.id = a.contact_id
             where a.company_id = $1
             order by c.last_name`,
            [id],
          ),
        ]);
        return {
          ...company.rows[0],
          parent: parent.rows[0] ?? null,
          children: children.rows,
          people: people.rows,
        };
      });
      if (!payload) return json(404, { error: "not_found" });
      return json(200, { data: payload });
    }

    const dealOne = rawPath.match(/^\/deals\/([0-9a-f-]{36})$/i);
    if (method === "GET" && dealOne) {
      const id = dealOne[1];
      const payload = await withTenant(principal, async (client) => {
        const deal = await client.query(
          `select d.id, d.name, d.pipeline_id, d.stage_id, d.amount_cents,
                  d.owner_id, d.tenant_id, p.name as pipeline_name, s.label as stage_label
           from deals d
           join pipelines p on p.id = d.pipeline_id
           join pipeline_stages s on s.id = d.stage_id
           where d.id = $1`,
          [id],
        );
        if (!deal.rowCount) return null;
        const parties = await client.query(
          `select dp.contact_id, dp.role, dp.is_primary, c.first_name, c.last_name
           from deal_parties dp
           join contacts c on c.id = dp.contact_id
           where dp.deal_id = $1
           order by dp.role`,
          [id],
        );
        const stages = await client.query(
          `select id, code, label, sort_index
           from pipeline_stages
           where pipeline_id = $1
           order by sort_index`,
          [deal.rows[0].pipeline_id],
        );
        return {
          ...deal.rows[0],
          parties: parties.rows,
          stages: stages.rows,
        };
      });
      if (!payload) return json(404, { error: "not_found" });
      return json(200, { data: payload });
    }

    if (method === "PATCH" && dealOne) {
      const id = dealOne[1];
      const body = parseBody(event);
      const stageId = body?.stage_id;
      if (!stageId) return json(400, { error: "stage_id_required" });
      const updated = await withTenant(principal, async (client) => {
        const current = await client.query(
          `select id, stage_id, tenant_id from deals where id = $1`,
          [id],
        );
        if (!current.rowCount) return null;
        const fromStage = current.rows[0].stage_id;
        await client.query(
          `update deals set stage_id = $2, updated_at = now() where id = $1`,
          [id, stageId],
        );
        await client.query(
          `insert into deal_stage_events
             (tenant_id, deal_id, from_stage_id, to_stage_id, actor_user_id)
           values ($1, $2, $3, $4, $5)`,
          [current.rows[0].tenant_id, id, fromStage, stageId, principal.userId],
        );
        await client.query(
          `insert into activities
             (tenant_id, object_type, object_id, actor_user_id, kind, body)
           values ($1, 'deal', $2, $3, 'stage_change', $4)`,
          [
            current.rows[0].tenant_id,
            id,
            principal.userId,
            `Stage moved to ${stageId}`,
          ],
        );
        return { id, stage_id: stageId };
      });
      if (!updated) return json(404, { error: "not_found" });
      return json(200, { data: updated });
    }

    if (method === "GET" && rawPath === "/pipelines") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, name, sort_index from pipelines order by sort_index, name`,
        ),
      );
      return json(200, { data: rows.rows, total: rows.rowCount });
    }

    if (method === "GET" && rawPath === "/pipeline-stages") {
      const pipelineId = qs.pipeline_id || null;
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, pipeline_id, code, label, sort_index, is_closed, is_won
           from pipeline_stages
           where ($1::uuid is null or pipeline_id = $1)
           order by sort_index`,
          [pipelineId],
        ),
      );
      return json(200, { data: rows.rows, total: rows.rowCount });
    }

    if (method === "GET" && rawPath === "/identifiers") {
      const idType = qs.type || null;
      const value = qs.value || null;
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, contact_id, id_type, value, tenant_id
           from contact_identifiers
           where ($1::text is null or id_type = $1)
             and ($2::text is null or value = $2)
           order by id_type, value`,
          [idType, value],
        ),
      );
      return json(200, { data: rows.rows, total: rows.rowCount });
    }

    return json(404, { error: "not_found" });
  } catch (err) {
    const message = String(err?.message || err);
    if (
      [
        "malformed_token",
        "bad_issuer",
        "bad_token_use",
        "bad_audience",
        "expired",
        "unknown_kid",
        "bad_signature",
      ].includes(message)
    ) {
      return json(401, { error: message });
    }
    return json(500, { error: message });
  }
}
