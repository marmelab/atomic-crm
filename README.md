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

W0 started. Atomic UI still runs against Supabase locally; we will strip that. Do not add mortgage fields on the Atomic schema.

Plan: [`docs/poc-plan.md`](docs/poc-plan.md)

## Demo tenants (planned)

- **Woodley Bank** — walkthrough
- **Harborline** — isolation

## Local (Atomic baseline, temporary)

Node 22, Make, Docker. `make install` then `make start` still boots upstream Atomic + local Supabase. That path goes away as W0–W4 land.

## License

MIT, same as upstream. See `LICENSE.md`.
