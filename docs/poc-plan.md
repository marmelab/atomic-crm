# Mortgage CRM POC plan

Working source of decisions for `ardley-crm`. Forked from [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm).

Vault original: `nate/PLACE/Mortgage CRM POC Plan.md`. Prefer PRs against this file once we are coding.

# Mortgage CRM POC Plan

Iterate this note until we are ready to fork [Atomic CRM](https://github.com/marmelab/atomic-crm) and write code. After the fork, promote the settled decisions into the repo wiki. A Google Doc is optional for sharing; this file is the working source.

Related: 2026-08-26 Jesse CRM walkthrough, Envoy Pre-POS, Envoy Single Pane of Glass, Opportunities for AI at Envoy

Upstream: [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm)

---

## 1. Why this exists

We need a CRM starting point we can fold into the existing PLACE / Envoy customer-engagement system. Atomic CRM is a strong UI and CRUD chassis (contacts, companies, deals, notes, tasks, kanban). It is **not** a mortgage graph, **not** multi-tenant, and **not** AWS-shaped.

This POC proves we can take Atomic’s shell, replace the relationship model, isolate tenants, demo a mortgage origination story, and run it on AWS **without Supabase**.

Jesse was explicit: the walkthrough must not freeze the design. The POC is a clickable conversation piece.

---

## 2. Confirmed decisions

| Topic | Decision |
|---|---|
| Deal vs title vs insurance | **N deals of one type**, linked via `record_links` (`related_deal`). Same `deals` table, different `pipeline_id`. Revisit after Jesse can click it. |
| Multi-tenant | Shared Aurora, `tenant_id` on every business row, RLS (or equivalent API enforcement). Two tenants in the demo. |
| Intra-tenant access (POC) | Owner edits; other users in the tenant view; tenant admin edits all. Association-driven sharing is **out of the POC**, but records carry the attributes Acorn will need later (`owner_id`, `branch_id`, `team_id`). |
| Primary demo tenant | **Woodley Bank** |
| Isolation tenant | **Harborline** (small seed; prove you cannot see it from Woodley) |
| Backend | **No Supabase.** Aurora Serverless v2 + Lambda API + Cognito + CloudFront. Sibling app to existing CES, not embedded in the consumer app. |
| Atomic posture | **Fork.** Do not plan to rebase via the shadcn registry after schema/show-page changes. |
| Documentation path | This markdown → iterate → fork wiki (and optional Google Doc for sharing). |
| Repo | **`ardley-crm`** under [Ardley-Technologies](https://github.com/Ardley-Technologies). Not bolted onto `ardley-purchase-consumer`. |
| Auth | **Reuse existing Ardley Cognito user pools** (see §8). New app client on those pools; no CRM-only pool. |
| Tenancy / authz | **[Acorn](https://github.com/Ardley-Technologies/acorn)** (`EvaluationPolicy.withIsolation('tenant_id')`). Tenant is **not** a Cognito pool attribute. Identity in the pool; tenant + permissions in the existing `ardley-role-configurations-*` tables. |
| POC roles | **LO**, **viewer**, **admin**. Managers / branch owners later — new Acorn configs, not a CRM schema change. |
| Acorn actions | `Crm*` names in §8. Stored `owner_id` is the CRM user UUID. Cognito `sub` is how we *find* that user, not what we persist on every row. |
| Deploy order | **dev → test → demo → prod.** First AWS env is **dev**. Customer walkthroughs use **demo**. |
| VPC | **Greenfield VPC for the POC.** A different existing VPC (not `ardley-purchase-consumer`) may be adopted later — FYI only. |
| Deal participants | **First-class `deal_parties` table** (role, dates, primary). `record_links` stays for the rest of the graph. Harder now, flexible later. |
| Primary keys | **UUIDs** on new and migrated tables (not Atomic bigint). |
| First walkthrough | **Jesse + Haley + Chris** |

---

## 3. Success criteria (write these on the box)

A reviewer can:

1. Log in as a Woodley Bank LO and **not** see Harborline data.
2. Open a borrower and see spouse, referring agent, PLACE team, LO, and the loan deal.
3. Open the team and see nested agents and referred deals.
4. Move a loan through numbered stages on the In Process pipeline; open a recruiting deal on a different pipeline.
5. Find someone by fake NMLS.
6. Merge an intentional duplicate.
7. Use a saved view **My Paired Agents**.
8. Hit a public HTTPS URL on AWS.

If that works, the meeting thesis is proven. Everything else is a sequel.

---

## 4. In scope vs out of scope

### In (POC)

- Fork Atomic; keep lists, show chrome, notes, tasks, kanban shell
- Tenants + `tenant_id` + isolation tests
- Graph: `record_links`, affiliations, nested companies
- One deal object + pipelines/stages (loan, recruit, B2B opportunity, onboard)
- Contact types; ENV vs custom lists (thin)
- Durable IDs (NMLS / DRE / MLS / email / phone)
- Minimal merge
- Mortgage-shaped Woodley + Harborline seed
- Saved views as home
- Coaching **stub** tab (extension point only)
- Dead “Issue pre-approval” button (adoption trick, not wired)
- AWS: Aurora Serverless v2, Lambdas, Cognito, CloudFront, CDK
- Identifier slots for later CES / Encompass IDs (correct grain: see §17)
- Append-only `activities` + `deal_stage_events` written even when the UI is thin
- `branch_id` / `team_id` nullable columns on owned records (unused by POC roles)

### Out (sequel)

- Association-driven sharing / Salesforce sharing rules
- Super-user customization (Jesse level C)
- Done-for-you marketing / Total Expert replacement (level A)
- Live NMLS / MLS / Brivity / ADP / Snowflake ingest
- OPTAH metrics, prescriptions, 30-day targets, AI lift
- Signal actioning as a service
- Title / insurance productization beyond linked deals
- Replacing Encompass
- Inbound email (Atomic edge functions)
- Property-level field security
- Folding CRM into `ardley-purchase-consumer` on day one

---

## 5. How this sits next to CES

CRM is a **sibling app** (e.g. `crm.*`) with SSO.

- Reuse the existing Ardley Cognito pools (dev / test / demo / prod). CRM is another app client on the same pool, not a new directory of users.
- **Acorn** authorizes the API. Cognito answers “who is this?” Acorn answers “which tenant, and what may they do?” Tenants do not live in the pool.
- Do not embed Atomic inside the consumer application.
- Point at existing IDs; do not clone the loan file.
  - Contact identifiers: NMLS / DRE / MLS / email / phone
  - Deal identifiers: `encompass_id`, `workspace_id` (and later title/insurance file ids)
- Deal stages in the POC are CRM-native. Later they can be driven by Encompass status. `deal_stage_events` still records the change.
- Coaching tab is a placeholder for work Haley / James already own.

---

## 6. Atomic: keep vs replace

### Keep

- React + Vite + shadcn / shadcn-admin-kit UI
- Contact / company / deal list and show **layout**
- Notes, tasks, activity timeline
- Kanban chrome (rebind to `pipeline_id` / `stage_id`)
- Import/export idea (not the generic SaaS CSV as the demo story)

### Replace before adding mortgage fields

| Jesse | Atomic today | Change |
|---|---|---|
| Any record linkable to any other | Contact → one company; deal → one company + `contact_ids[]` | `record_links` + `contact_affiliations` |
| Nested companies | Flat `companies` | `parent_company_id`, `company_kind` |
| Dynamic pipelines | `deals.stage` string; categories in app constants | `pipelines` + `pipeline_stages` |
| Contact is any human | Implicit prospect-at-a-company | `contact_types` |
| Durable ID ≠ email | Email + name | `contact_identifiers` |
| Duplicates are normal | No merge | `merged_into_id` + admin merge |
| Access | RLS ≈ logged-in sees all | Tenant RLS + owner/viewer |
| Delete company | `ON DELETE CASCADE` wipes people | Do not cascade-delete contacts/deals |

`contacts.company_id` stays nullable for a short compat window. New UI uses affiliations only.

Treat `contact_ids[]` and `tags[]` as legacy. New reporting uses join tables.

---

## 7. Data model (POC)

Read [[#17. Long-term design]] before adding a column. The POC implements a subset of that model, not a different one.

Shared Aurora, one schema. Every business table: `tenant_id not null`.

### Tenancy and users

- `tenants` — UUID PK **must be the same id Acorn already uses for that customer** (see §17). Also store `slug`, `name`. Woodley Bank, Harborline.
- `crm_users` (rename Atomic `sales`) — `id` UUID, `tenant_id`, `cognito_sub` unique, `contact_id` (the human), disabled flag. **Stored `owner_id` on records = `crm_users.id`**, never the raw `sub`.
- Unique indexes are **per tenant** (e.g. unique `(tenant_id, id_type, value)` on identifiers)

### People and orgs

- `contact_types` catalog — borrower, potential_borrower, real_estate_agent, loan_officer, employee, recruit. Seed `ENV_*` as org-managed.
- `contact_type_assignments` — a contact has **many** types; `is_primary` is display-only. Do not use a single `primary_type_id` as the only type (people change hats by the hour).
- `contact_identifiers` — `(tenant_id, id_type, value)` unique. Types: `nmls`, `dre`, `mls`, `email`, `phone`. **Encompass / workspace IDs belong on the deal (or a future application object), not the person.**
- `contact_affiliations` — contact ↔ company, role, start/end, `is_primary`. This is the only “works at / belongs to org” model. Do not also put `employed_by` on `record_links`.
- `contacts.merged_into_id` nullable
- `companies.parent_company_id` (tree, not DAG, for the POC)
- `company_kinds` catalog — brokerage, place_team, builder, employer, lender_branch
- View `company_tree` (recursive)

### Graph

`record_links` is the **non-membership** graph only (spouse, paired_agent, coach_of, referred_by, related_deal).

- `from_object_type`, `from_id`, `to_object_type`, `to_id` — types from an `object_types` catalog (`contact`, `company`, `deal`), not raw table names
- `link_type_id` → `link_types` catalog (directed vs symmetric, allowed endpoint types)
- `tenant_id`, optional `valid_from` / `valid_to`
- Unique on `(tenant_id, link_type_id, from_object_type, from_id, to_object_type, to_id)` where `valid_to` is null

Symmetric types (`spouse`, `paired_agent`): write **one** row; queries look both directions. Do not dual-write.

Reporting in the POC = related-records panel, not a report builder.

Deal participants live on **`deal_parties`**, not on `record_links`:

- `deal_id`, `contact_id`, `role` (borrower, co-borrower, referring_agent, loan_officer, …)
- `is_primary`, optional start/end
- Unique `(tenant_id, deal_id, contact_id, role)` so the same person can be LO on one deal and referring agent on another

`on_deal` is **not** a `record_links` type.

### Pipelines

- `pipelines` (name, applies to deals, sort)
- `pipeline_stages` (pipeline_id, code, label, sort_index, is_closed, is_won)
- `deals.pipeline_id`, `deals.stage_id`
- `deals.amount_cents` bigint (not float, not Atomic’s loosely typed amount)
- `deal_stage_events` — append-only on every stage change (who, from, to, at). POC UI can ignore it; reporting cannot be backfilled later.
- Owned records (`contacts`, `companies`, `deals`) also have nullable `branch_id`, `team_id` for future Acorn scopes. POC roles do not use them.
- Do not keep a shadow `deals.stage` text column. Bind kanban to `stage_id`.

Seed pipelines (Envoy-shaped, Woodley-branded copy):

- Lead - Active
- Lead - Nurture / Inactive
- Loan Setup
- In Process Loans
- Closed / Archive
- Mortgage opportunity (B2B on a real estate team)
- Recruiting - All Roles
- Onboarding

Number stages so sorts work (`02 - Lead Attempted`, `04 - App Started`, …).

### Lists vs views (do not collapse)

- `lists` + `list_members` + `is_env` — **explicit membership** (ENV paired agents).
- `saved_views` — **stored query** (filters, sort, pipeline). “My Borrowers” is a view, not a list, unless someone pins members.
- Seed both so the walkthrough still works. No list-builder product.

### Activity (write it even if the UI is Atomic notes)

- `activities` append-only: `object_type`, `object_id`, `actor_user_id`, `kind` (note, task, stage_change, system), `body`, `at`
- Notes and tasks are rows (or point at this stream). Do not start a second timeline we have to merge with CES later.

### Hooks, not products

- Search index / denormalized `contacts.nmls_id` is OK if identifiers stay source of truth
- `deals.source`
- Optional `signals` rows so 2–3 contacts can show a fake “in the money” badge
- No Atomic singleton `configuration` jsonb for custom fields. If we need a catch-all: `custom_field_defs` (tenant, object_type, key) + `custom_field_values`. Prefer real columns for mortgage-critical facts.

### Open schema notes

- **UUIDs everywhere** we control. Atomic’s bigint IDs do not survive the fork; budget UI/`Identifier` churn in W0–W1.
- Merge tombstone only (`merged_into_id`). Not a general soft-delete system. Reads of a merged id redirect.
- Postgres RLS encodes **tenant isolation only**. Owner / role rules live in Acorn. Do not duplicate LO-owner policy in RLS (it will fight branch-owner later).

---

## 8. API and AWS shape

```
Browser (CloudFront + S3)
        |
     Cognito (JWT)
        |
   API Gateway → Lambdas
        |
   Aurora Serverless v2 (Postgres)
```

### Why this, not Supabase

Long-term fit with existing PLACE/Envoy AWS (CDK, Cognito, CloudFront). Avoids a second auth/data plane and a financial-services review of Supabase. Atomic inbound-email edge functions are out of POC anyway.

### API style (POC)

- Small Lambda **BFF**, not PostgREST-on-Lambda as the public surface (authz and tenant injection stay in one place).
- One router Lambda (or a handful: `contacts`, `companies`, `deals`, `graph`, `admin`) behind HTTP API Gateway.
- Every query binds `tenant_id` from the **Acorn principal**, not from a Cognito custom attribute. Defense in depth: Acorn isolation policy **and** Postgres RLS **and** API filter.
- Aurora Serverless v2 in a VPC; Lambdas in the same VPC (or RDS Proxy if connection storms show up).
- Secrets in Secrets Manager; no secrets in the SPA beyond Cognito client id and API URL.

### Cognito pools to reuse

Do not create a CRM user directory. Add a CRM app client (and callback URLs) to the pool for the environment we deploy.

| env | pool id | hosted domain | IdPs | paired table |
|---|---|---|---|---|
| dev | `us-east-1_m3IX8Cc9L` | ardley-app-users-dev | none | ardley-customer-users-dev |
| test | `us-east-1_nIneVR5Wf` | ardley-app-users-test | envoy-sso-azure + woodley-sso-azure | ardley-customer-users-test |
| demo | `us-east-1_MErm7hWed` | ardley-app-users-demo | none | ardley-customer-users-demo |
| prod | `us-east-1_UFnHNuW7a` | ardley-app-users-prod | envoy-sso-azure | ardley-customer-users-prod |

**Deploy order:** stand up **dev** first, then test, demo, prod. Jesse / Haley / Chris customer-style walkthroughs happen on **demo**. Woodley Azure SSO already exists on **test** — use test when we want to show SSO, not as the first deploy.

Map Cognito `sub` → Acorn principal → `sales.user_id`. **`tenant_id` comes from Acorn** (`EvaluationPolicy.withIsolation('tenant_id')`), not from pool claims and not from inventing a second mapping in CRM.

### Acorn store (reuse, do not fork)

Permission JSON already lives in Dynamo per env. CRM Lambdas **read these tables**; we do not create a CRM-local permission store.

| table | items (approx) | customers with `ROLE#` config |
|---|---|---|
| `ardley-role-configurations-dev` | 1,257 | 31 |
| `ardley-role-configurations-test` | 2,184 | 31 |
| `ardley-role-configurations-demo` | 420 | 20 |
| `ardley-role-configurations-prod` | 1,209 | 36 |

POC seed adds CRM actions + three roles into those tables for Woodley (and a tiny Harborline set). Same Acorn evaluation as other Ardley APIs.

**POC roles and actions**

Prefix `Crm` so these never collide with other Ardley actions in the same Dynamo tables.

| Action | viewer | LO | admin |
|---|---|---|---|
| `CrmListContacts` `CrmGetContact` `CrmListCompanies` `CrmGetCompany` `CrmListDeals` `CrmGetDeal` | all (tenant) | all (tenant) | all |
| `CrmCreateContact` `CrmUpdateContact` `CrmCreateCompany` `CrmUpdateCompany` `CrmCreateDeal` `CrmUpdateDeal` | — | `owner_id` match principal | all |
| `CrmMergeContact` | — | — | all |

- Isolation: `EvaluationPolicy.withIsolation('tenant_id')` on every resource. The value **is the existing Ardley customer id**, not a CRM-minted tenant UUID.
- Principal: Cognito JWT → lookup `crm_users` by `cognito_sub` → Acorn principal `{ tenant_id, owner_id: crm_users.id, branch_id?, team_id? }`.
- Resources expose `tenant_id`, `owner_id`, and nullable `branch_id` / `team_id`. Atomic `sales_id` is replaced by `owner_id`.
- Notes / tasks / graph / lists: fold writes into `CrmUpdate*` for the POC, or add matching `Crm*` actions later.
- Do **not** add `CrmListUsers` / `CrmManageRoles` — Acorn already owns roles.
- Managers / branch owners later: more Acorn JSON on `branch_id` / `team_id`. Columns exist from day one so that is not a rewrite.

Example LO allow on writes:

```json
{
  "allow": {
    "CrmListContacts": "all",
    "CrmGetContact": "all",
    "CrmUpdateContact": { "owner_id": { "match": "principal" } }
  }
}
```

> **Note:** Pool pairing vs Acorn
> `ardley-customer-users-*` pairs Cognito users to customer records for existing apps. CRM must not create a third tenant story. Identity: Cognito. Tenant + permissions: Acorn (`ardley-role-configurations-*`). CRM `sales.tenant_id` is a projection of Acorn, kept in sync on login / seed.

### Frontend

- Vite SPA from the Atomic fork, env: Cognito + API base URL.
- Replace `@supabase/*` with `fetch` + Cognito tokens.
- This is the largest mechanical delete in the fork. Budget it; do not leave a half-Supabase client.

### CDK

New stack in repo **`ardley-crm`** under [Ardley-Technologies](https://github.com/Ardley-Technologies), not bolted onto `ardley-purchase-consumer`.

Constructs:

- **New VPC** for this POC (later we may attach the other existing VPC — not the purchase-consumer one)
- Aurora Serverless v2 Postgres
- HTTP API + Lambdas
- Cognito **app client** on the existing pool for that env (see table above) — do not create a pool
- Acorn via `@ardley-technologies/acorn-lambda`, loading from **`ardley-role-configurations-{env}`** (existing tables; IAM read + seed write). Isolation: `tenant_id`.
- CloudFront + S3
- Seed task (Lambda or one-shot) for Woodley / Harborline

### Compliance for a demo

Seed data is **obviously fake**. No real borrower emails. Isolation tests are part of the definition of done even for a POC.

---

## 9. UI (what the walkthrough clicks)

Keep Atomic lists. Change show pages and home.

1. **Contact show** — type badge, identifiers, affiliations, related-graph panel (spouse, agent, LO, team, deals), existing timeline.
2. **Company show** — parent + children, people via affiliations, referred deals.
3. **Deal show / kanban** — pipeline switcher changes stages; numbered stages; parties with roles.
4. **Home = saved views**, not a generic sales dashboard: My Borrowers · My Paired Agents · Recruiting · In-process loans.
5. **Copy / theme** — Woodley Bank CRM. Deal = opportunity. Amount = loan amount. Drop SaaS “sector” language.
6. **Coaching stub** — if type is employee or LO, tab labeled OPTAH / Coaching: “coming.”
7. **Merge** — **admin** action on a contact (matches `CrmMergeContact`).
8. **Dead button** on loan deal: “Issue pre-approval.”

Record-type-driven tabs stop at the stub. No FORWARD / prescriptions UI.

---

## 10. Demo data

### Woodley Bank (primary)

Enough for the click-tour:

- 1 lender + 3 branches
- 4 PLACE-like teams (include a “Agents with a Smile” analogue), nested under a brokerage
- ~40 agents
- ~15 LOs + ~8 staff (Tara-like coach, Phil-like LO)
- ~80 borrowers / potential borrowers; spouses are **separate contacts**
- ~60 loan deals across Lead / In Process / Closed
- ~8 recruiting deals, ~5 B2B mortgage-opportunity deals
- Fake NMLS / DRE that look real
- 3 intentional duplicates (two emails, NMLS missing on one)
- A few closed-years-ago loans with a fake “in the money” flag

Loan triangle must be complete on at least **three** showcase contacts so the demo is not one lucky row.

### Harborline (isolation)

~5 contacts, 1 company, 1 deal. Login as Woodley → empty search for those names.

Script in SQL or TypeScript against the new tables. Do **not** use Atomic `test-data/contacts.csv` as the story.

---

## 11. Workstreams

Roughly 3–5 weeks for a small team; 1–2 people will slip.

| ID | Work | Days | Outcome |
|---|---|---|---|
| W0 | Create `ardley-crm` from Atomic, strip Supabase, UUID PKs, Cognito against existing pools, empty Lambda hello, `tenants` aligned to Ardley customer ids, `crm_users` | 3–5 | Two-tenant smoke locally (Docker Postgres is fine before Aurora) |
| W1 | Graph schema: type assignments, affiliations, identifiers, `record_links` + catalogs, **`deal_parties`**, pipelines, `activities`, `deal_stage_events`, `branch_id`/`team_id` | 3–5 | SQL migrations; no cascade-delete of people |
| W2 | UI for the triangle + pipeline kanban + types | 5–7 | Clickable graph |
| W3 | Woodley / Harborline seed, saved views, merge, theme | 3–4 | Demo story |
| W4 | CDK: Aurora, API, Cognito app client, Acorn wiring, CloudFront; **dev first**, then test / demo / prod | 4–6 | Public HTTPS on dev |
| W5 | Walkthrough harden + isolation tests + “this is a POC” chrome | 2–3 | Ready for Jesse + Haley + Chris |

Local dev can use Postgres in Docker with the same schema as Aurora. Do not require AWS for W0–W3.

---

## 12. Risks

1. **Fork, not a tracking branch.** Schema and show pages will diverge; registry updates will not apply cleanly.
2. **Supabase deletion is bigger than it looks.** Auth, storage, types, and data provider are woven through Atomic.
3. **Array FKs** (`contact_ids`, `tags`) fight reporting — leave them behind early.
4. **Lambda + Aurora cold start / connections** — plan RDS Proxy if W4 load tests look ugly; not a day-one requirement.
5. **Design is not frozen.** If Jesse hates N deals, links are cheap to reinterpret.
6. **PII optics** — fake data only on the public URL.
7. **Two identity keys** — if we persist Cognito `sub` as `owner_id`, SSO re-provision and ownership transfer break. Persist `crm_users.id`.
8. **Two tenant keys** — if CRM mints its own `tenants.id`, Acorn isolation and CES will never line up. Use the existing customer id.
9. **User ≠ contact** — if LOs exist only in `crm_users`, coaching/recruiting/graph cannot point at them. Every human is a contact; login is a projection.

---

## 13. Documentation after we fork

1. Keep iterating **this note** until W0 starts.
2. On fork: copy settled sections into the **GitHub wiki** (or `/docs` if we want them versioned with PRs). Suggested wiki pages:
   - Overview and success criteria
   - Decisions log
   - Data model
   - AWS
   - Demo script (click path)
3. Optional Google Doc: paste a snapshot when we need comments from people who will not open the vault or the wiki.

---

## 14. Open questions

Settled 2026-08-27 — see §2.

Settled this pass:

- Tenant is **Acorn**, not the Cognito pool. See [Ardley-Technologies/acorn](https://github.com/Ardley-Technologies/acorn) isolation policy.
- Deploy order **dev → test → demo → prod**. First AWS work is **dev**. Audience walkthrough is **demo**.
- Org is **[Ardley-Technologies](https://github.com/Ardley-Technologies)**.

Settled this pass:

- Acorn JSON lives in existing **`ardley-role-configurations-{env}`** Dynamo tables. No CRM-local store.
- POC roles: **LO**, **viewer**, **admin**.
- Actions: `CrmList*` / `CrmGet*` / `CrmCreate*` / `CrmUpdate*` / `CrmMergeContact` as in §8.
- Owner: `owner_id` = Cognito `sub`; LO writes use `{ "owner_id": { "match": "principal" } }`.

No product-strategy questions left. Confirm with platform (not Jesse) before W0:

- [ ] Exact Ardley **customer id** field Acorn isolation already uses — that value **is** `tenants.id`.
- [ ] Whether `crm_users` can be inserted on first CRM login if the human is not yet in `ardley-customer-users-*`, or we only allow known customer-users.

---

## 15. Next step after this note

Iterate this file until the open questions we care about are checked. Then:

1. Fork Atomic.
2. Add `/docs` or wiki from this note.
3. Start W0 (Postgres + tenant column + delete Supabase client).

No coding until we say this plan is good enough.

---

## 16. Click script (draft)

Use this as the W5 demo outline; refine when seed names exist.

1. Log in as Woodley LO.
2. Home → **My Paired Agents** → open an agent → see team + referred borrowers.
3. Open a borrower → graph: spouse, agent, team, LO, loan.
4. Open the loan → move stage on In Process.
5. Switch to a recruiting deal on the same LO contact (different pipeline).
6. Search NMLS → land on the same person.
7. Admin: merge the duplicate pair.
8. Log in as Harborline (or search Harborline names as Woodley) → isolation.
9. Point at Coaching stub and Issue pre-approval (intentionally unfinished).

---

## 17. Long-term design

This section is the point of the second pass. The POC should be a **thin slice of this model**, not a disposable schema we migrate off of after Jesse says yes.

Flexibility here means: new relationship types, new deal pipelines, new Acorn roles (manager, branch owner), and CES/Encompass links without rewriting tables. Reliability here means: one identity, one tenant key, referential rules we can test, and an audit trail we do not backfill.

### Invariants (do not violate in W0–W5)

1. **One human row.** Every person — borrower, spouse, agent, LO, coach, recruit, employee — is a `contacts` row. `crm_users` is “this human can log in,” pointed at `contact_id`. Recruiting an LO, coaching Tara, and assigning a deal party all use the same id.
2. **One tenant key.** `tenants.id` = Acorn isolation `tenant_id` = existing Ardley customer id. CRM does not mint a parallel tenant namespace.
3. **One owner key.** Rows store `owner_id` = `crm_users.id`. Cognito `sub` lives only on `crm_users.cognito_sub`. Transfer and re-SSO are row updates, not a rewrite of every deal.
4. **Acorn decides who may act; Postgres only isolates tenants.** RLS: `tenant_id = current_tenant()`. Owner, branch, and team rules stay in Acorn JSON so they can change without migrations.
5. **Membership ≠ graph ≠ party.**
   - Org membership → `contact_affiliations`
   - Deal cast → `deal_parties`
   - Everything else durable and reportable → `record_links`
   Do not store the same fact in two of these.
6. **Typed catalogs, not magic strings.** `object_types`, `link_types`, `contact_types`, `company_kinds`, `identifier_types`, `deal_party_roles`. Adding “title opportunity” or “coach_of” is a row, not a deploy that greps enums in the UI only.
7. **External systems attach at the right grain.** NMLS/DRE/MLS/email → contact. Encompass loan id / CES workspace → **deal** (or a future `applications` object), never the person. A person has many loans over time.
8. **Append-only facts.** Stage moves and timeline events are inserted, not overwritten. Current stage on `deals` is a cache of the latest event.
9. **Lists are sets; views are queries.** Mixing them recreates HubSpot’s “this isn’t actually linked” problem.
10. **No cascade delete of people.** Archive companies; affiliations end; contacts remain.

### What we deliberately do *not* generalize yet

| Flexible later | Frozen now | Why |
|---|---|---|
| Association sharing, queues, territories | Single `owner_id` + unused `branch_id`/`team_id` | Sharing rules are a product; columns are cheap, a sharing engine is not |
| Schema-per-tenant / dedicated cluster | Shared Aurora + `tenant_id` | Ops switch, not a logical-model switch |
| Household object | Spouse (and other) links | Jesse: four contacts, not one household |
| Company DAG / multi-parent | Single `parent_company_id` | PLACE team trees are trees |
| Custom-field product | Real columns + optional EAV | JSON configuration (Atomic) is neither reportable nor ENV-governable |
| EventBridge / CES bus | HTTP sibling + identifiers | Don’t couple deploy of CRM to Encompass |
| Property-level field security | Object-level Acorn actions | Salesforce-style FLS is a different product |

### Corrections this pass made to earlier text

- **Cognito `sub` as stored `owner_id`** — too brittle. `sub` is the lookup key; `crm_users.id` is the foreign key.
- **Single `contacts.primary_type_id`** — too small. Many types via `contact_type_assignments`; primary is a badge.
- **`employed_by` on `record_links` plus affiliations** — pick affiliations.
- **`encompass_id` / `workspace_id` on the contact** — wrong grain; put them on the deal.
- **Lists as the only “saved view”** — split list vs view.
- **RLS that encodes owner** — would block branch-owner Acorn later.
- **Atomic `sales` name and `configuration` jsonb** — don’t keep them as the long-term shape.

### Flexibility vs reliability (explicit tradeoffs)

- **Polymorphic `record_links`** is less referentially safe than a pile of typed join tables. We accept that so “any record to any record” stays possible. Reliability comes from the `link_types` catalog (allowed endpoints) and tests, not from Postgres FKs to a single parent table.
- **`deal_parties` is less “one graph to rule them all.”** We accept the extra table so loan cast, dates, and roles stay queryable and constrained. That is reliability where money and compliance live.
- **Acorn JSON for roles** is more flexible than hardcoded `if admin`. Reliability is deny-wins, isolation policy, and a fixed `Crm*` action catalog — not free-form strings in handlers.
- **Unused `branch_id` / `team_id`** looks like YAGNI. The alternative is a painful backfill once every deal needs a branch scope. Nullable columns are the cheap side of the tradeoff.

### Platform questions (not Jesse)

These block a clean W0, not the walkthrough story:

1. What identifier Acorn already puts on the principal as `tenant_id` (customer UUID vs slug vs Dynamo key).
2. Must a CRM login already exist in `ardley-customer-users-*`, or may we create `crm_users` + contact on first seen `sub`?
