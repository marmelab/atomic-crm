# Data model (as of W3)

Source of truth: [`schema-direction.sql`](schema-direction.sql). Plan invariants: [`poc-plan.md`](poc-plan.md) §17.

Rendered: [loan triangle](data-model-relationships.png) · [tables](data-model-er.png)

Every business table has `tenant_id` (Postgres UUID). Acorn isolation uses the Ardley customer id string (`100004` / `100081`). RLS is tenant-only; owner / branch / team stay in Acorn.

## Three kinds of relationship (do not collapse)

```mermaid
flowchart LR
  subgraph membership["Membership — contact_affiliations"]
    C1[contact] --- A[works at] --- O[company]
  end
  subgraph parties["Deal cast — deal_parties"]
    C2[contact] --- P[role] --- D[deal]
  end
  subgraph graph["Everything else — record_links"]
    X[contact / company / deal] --- L[link_type] --- Y[contact / company / deal]
  end
```

| Kind | Table | Examples | Not |
|---|---|---|---|
| Org membership | `contact_affiliations` | Avery is an agent at Agents with a Grin | `employed_by` on `record_links` |
| Deal cast | `deal_parties` | Willow is borrower on Willow purchase | `on_deal` as a link type |
| Durable graph | `record_links` | spouse, paired_agent, coach_of, referred_by, related_deal | org membership or deal roles |

Lists (`lists` + `list_members`) are **explicit sets**. Saved views are **stored queries**. Mixing them recreates HubSpot’s “this isn’t actually linked” problem.

## Loan triangle (what you click)

```mermaid
flowchart TB
  Brokerage["company: Woodley Realty"]
  Team["company: Agents with a Grin"]
  Brokerage -->|parent_company_id| Team

  Avery["contact: Avery Agent"]
  Phil["contact: Phil Officer"]
  Willow["contact: Willow Woodley"]
  Sam["contact: Sam Spouse"]
  Deal["deal: Willow purchase"]

  Avery -->|affiliation agent| Team
  Willow ---|record_link spouse| Sam
  Phil ---|record_link paired_agent| Avery

  Willow -->|party borrower| Deal
  Sam -->|party co_borrower| Deal
  Avery -->|party referring_agent| Deal
  Phil -->|party loan_officer| Deal
```

## Tables

```mermaid
erDiagram
  tenants ||--o{ crm_users : tenant
  tenants ||--o{ contacts : tenant
  tenants ||--o{ companies : tenant
  tenants ||--o{ deals : tenant

  crm_users ||--o{ contacts : owns
  crm_users ||--o{ companies : owns
  crm_users ||--o{ deals : owns
  crm_users }o--o| contacts : "is also"

  contacts ||--o{ contact_type_assignments : hats
  contact_types ||--o{ contact_type_assignments : type
  contacts ||--o{ contact_identifiers : ids
  identifier_types ||--o{ contact_identifiers : kind

  contacts ||--o{ contact_affiliations : member
  companies ||--o{ contact_affiliations : org
  company_kinds ||--o{ companies : kind
  companies ||--o{ companies : parent

  pipelines ||--o{ pipeline_stages : stages
  pipelines ||--o{ deals : book
  pipeline_stages ||--o{ deals : current
  deals ||--o{ deal_parties : cast
  contacts ||--o{ deal_parties : person
  deal_party_roles ||--o{ deal_parties : role
  deals ||--o{ deal_stage_events : history

  object_types ||--o{ link_types : endpoints
  link_types ||--o{ record_links : type
  tenants ||--o{ record_links : tenant

  lists ||--o{ list_members : members
  crm_users ||--o{ saved_views : owner
  object_types ||--o{ activities : about
  object_types ||--o{ list_members : about
  object_types ||--o{ saved_views : about

  tenants {
    uuid id PK
    text ardley_customer_id UK
    text slug
    text name
  }
  crm_users {
    uuid id PK
    uuid tenant_id FK
    text cognito_sub UK
    uuid contact_id FK
    uuid owner_id "stored on records = this id"
  }
  contacts {
    uuid id PK
    uuid tenant_id FK
    uuid owner_id FK
    text first_name
    text last_name
    uuid merged_into_id FK
  }
  companies {
    uuid id PK
    uuid tenant_id FK
    uuid owner_id FK
    uuid parent_company_id FK
    text kind_id FK
    text name
  }
  deals {
    uuid id PK
    uuid tenant_id FK
    uuid owner_id FK
    uuid pipeline_id FK
    uuid stage_id FK
    text name
    bigint amount_cents
    text encompass_id
    text workspace_id
  }
  contact_affiliations {
    uuid id PK
    uuid contact_id FK
    uuid company_id FK
    text role
    date valid_to
  }
  deal_parties {
    uuid id PK
    uuid deal_id FK
    uuid contact_id FK
    text role FK
    boolean is_primary
  }
  record_links {
    uuid id PK
    text link_type_id FK
    text from_object_type
    uuid from_id
    text to_object_type
    uuid to_id
    date valid_to
  }
  contact_identifiers {
    uuid id PK
    uuid contact_id FK
    text id_type FK
    text value
  }
```

`record_links.from_id` / `to_id` are polymorphic (typed by `object_types`). Reliability is the `link_types` catalog + tests, not a Postgres FK to one parent table.

## Catalogs already seeded

| Catalog | Values |
|---|---|
| `object_types` | contact, company, deal |
| `link_types` | spouse, paired_agent, coach_of, referred_by, related_deal |
| `contact_types` | borrower, potential_borrower, real_estate_agent, loan_officer, employee, recruit |
| `company_kinds` | brokerage, place_team, builder, employer, lender_branch |
| `identifier_types` | nmls, dre, mls, email, phone |
| `deal_party_roles` | borrower, co_borrower, referring_agent, loan_officer, recruit |

NMLS / DRE / email / phone live on the **contact**. Encompass / CES workspace ids live on the **deal**.

## Deliberately unused (columns exist)

- `contacts.branch_id` / `team_id` (and same on companies / deals) — for later Acorn scopes
- `company_tree` view — recursive parent walk
- `activities` / `deal_stage_events` — append-only; UI is still thin

## Not in this model

Household object (four contacts + spouse link instead). Company DAG. Atomic `sales` / `configuration` jsonb. Cascade-delete of people (`ON DELETE RESTRICT`).
