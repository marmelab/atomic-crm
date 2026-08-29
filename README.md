# ardley-crm

Mortgage-oriented CRM for PLACE / lender customer-engagement. Forked from [Atomic CRM](https://github.com/marmelab/atomic-crm) (MIT).

This is **not** a tracking fork. Schema, auth, and hosting diverge on purpose:

| Atomic | This repo |
|---|---|
| Single-tenant | Multi-tenant (`tenant_id` = Ardley customer id) |
| Supabase | Aurora Serverless v2 + Lambda + Cognito + Acorn |
| bigint PKs | UUIDs |
| Email-centric contacts | Graph + durable IDs (NMLS / DRE) + deal parties |

## Status

W0 is on `main` (local BFF + tenant smoke). **W1** adds the graph schema slice and one Woodley loan triangle. No graph UI yet.

Plan: [`docs/poc-plan.md`](docs/poc-plan.md) · W1: [`docs/w1.md`](docs/w1.md)

## Demo tenants

- **Woodley** (`100004`) — walkthrough
- **Envoy Mortgage** (`100081`) — isolation

`tenants.id` is `uuid5(uuid5(DNS, 'ardley-crm.tenants'), customer_id)`. Acorn still isolates on the customer id string.

## Local Postgres (W0)

Docker Postgres on **5433** (avoids clashing with Supabase).

```bash
make w1-smoke
```

That resets the DB, applies [`docs/schema-direction.sql`](docs/schema-direction.sql), seeds W0 + the W1 triangle, and asserts RLS plus no cascade-delete of people.

```
postgres://ardley:ardley@127.0.0.1:5433/ardley_crm
```

App role for RLS checks: `crm_app` / `crm_app` (sets `app.tenant_id`).

## Local (Atomic baseline, temporary)

Node 22, Make, Docker. `make install` then `make start` still boots upstream Atomic + local Supabase.

## License

MIT, same as upstream. See `LICENSE.md`.
