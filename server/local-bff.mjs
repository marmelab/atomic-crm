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
    "access-control-allow-methods": "GET,PATCH,POST,OPTIONS",
  });
  res.end(payload);
}

function readBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on("data", (chunk) => chunks.push(chunk));
    req.on("end", () => {
      if (!chunks.length) {
        resolve({});
        return;
      }
      try {
        resolve(JSON.parse(Buffer.concat(chunks).toString("utf8")));
      } catch (err) {
        reject(err);
      }
    });
    req.on("error", reject);
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
      const q = url.searchParams.get("q");
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
      json(res, 200, { data: rows.rows, total: rows.rowCount });
      return;
    }

    if (req.method === "POST" && url.pathname === "/contacts/merge") {
      const body = await readBody(req);
      const loserId = body?.loser_id;
      const winnerId = body?.winner_id;
      if (!loserId || !winnerId || loserId === winnerId) {
        json(res, 400, { error: "loser_id_and_winner_id_required" });
        return;
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
      if (!merged) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, { data: merged });
      return;
    }

    if (req.method === "GET" && url.pathname === "/saved-views") {
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
      json(res, 200, { data: rows, total: rows.length });
      return;
    }

    if (req.method === "GET" && url.pathname === "/companies") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, name, kind_id, parent_company_id, owner_id, tenant_id
           from companies
           order by name`,
        ),
      );
      json(res, 200, { data: rows.rows, total: rows.rowCount });
      return;
    }

    if (req.method === "GET" && url.pathname === "/deals") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, name, pipeline_id, stage_id, amount_cents, owner_id, tenant_id
           from deals
           order by name`,
        ),
      );
      json(res, 200, { data: rows.rows, total: rows.rowCount });
      return;
    }

    const contactOne = url.pathname.match(/^\/contacts\/([0-9a-f-]{36})$/i);
    if (req.method === "GET" && contactOne) {
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
      if (!payload) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, { data: payload });
      return;
    }

    const companyOne = url.pathname.match(/^\/companies\/([0-9a-f-]{36})$/i);
    if (req.method === "GET" && companyOne) {
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
      if (!payload) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, { data: payload });
      return;
    }

    const dealOne = url.pathname.match(/^\/deals\/([0-9a-f-]{36})$/i);
    if (req.method === "GET" && dealOne) {
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
      if (!payload) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, { data: payload });
      return;
    }

    if (req.method === "PATCH" && dealOne) {
      const id = dealOne[1];
      const body = await readBody(req);
      const stageId = body?.stage_id;
      if (!stageId) {
        json(res, 400, { error: "stage_id_required" });
        return;
      }
      const updated = await withTenant(principal, async (client) => {
        const current = await client.query(
          `select id, stage_id, tenant_id from deals where id = $1`,
          [id],
        );
        if (!current.rowCount) return null;
        const fromStage = current.rows[0].stage_id;
        await client.query(`update deals set stage_id = $2, updated_at = now() where id = $1`, [
          id,
          stageId,
        ]);
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
      if (!updated) {
        json(res, 404, { error: "not_found" });
        return;
      }
      json(res, 200, { data: updated });
      return;
    }

    if (req.method === "GET" && url.pathname === "/pipelines") {
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, name, sort_index from pipelines order by sort_index, name`,
        ),
      );
      json(res, 200, { data: rows.rows, total: rows.rowCount });
      return;
    }

    if (req.method === "GET" && url.pathname === "/pipeline-stages") {
      const pipelineId = url.searchParams.get("pipeline_id");
      const rows = await withTenant(principal, (client) =>
        client.query(
          `select id, pipeline_id, code, label, sort_index, is_closed, is_won
           from pipeline_stages
           where ($1::uuid is null or pipeline_id = $1)
           order by sort_index`,
          [pipelineId],
        ),
      );
      json(res, 200, { data: rows.rows, total: rows.rowCount });
      return;
    }

    if (req.method === "GET" && url.pathname === "/identifiers") {
      const idType = url.searchParams.get("type");
      const value = url.searchParams.get("value");
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
