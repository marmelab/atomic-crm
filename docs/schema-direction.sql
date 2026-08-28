-- Directional schema for ardley-crm.
-- Applied locally by `make w0-smoke` (Docker Postgres). Aurora later (W4).
-- Invariants: docs/poc-plan.md §17

create extension if not exists "pgcrypto";
create extension if not exists "citext";
create extension if not exists "uuid-ossp";

-- tenants.id is a deterministic UUID mapped from ardley-customers-{env} id
-- (uuid5). Acorn isolation still uses ardley_customer_id (e.g. '100081').
create table tenants (
    id uuid primary key,
    ardley_customer_id text not null unique, -- '100004' Woodley, '100081' Envoy
    slug text not null unique,
    name text not null,
    created_at timestamptz not null default now()
);

create table object_types (
    id text primary key -- contact | company | deal
);

create table link_types (
    id text primary key,
    directed boolean not null default true,
    from_object_type text not null references object_types (id),
    to_object_type text not null references object_types (id)
);

create table contact_types (
    id text primary key,
    label text not null,
    is_env boolean not null default false
);

create table company_kinds (
    id text primary key,
    label text not null
);

create table identifier_types (
    id text primary key -- nmls | dre | mls | email | phone
);

create table deal_party_roles (
    id text primary key -- borrower | co_borrower | referring_agent | loan_officer | ...
);

create table crm_users (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    cognito_sub text not null,
    contact_id uuid, -- filled after contacts exist; avoid circular FK at create
    email citext,
    disabled boolean not null default false,
    unique (cognito_sub),
    unique (tenant_id, id)
);

create table companies (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    owner_id uuid not null references crm_users (id),
    parent_company_id uuid references companies (id),
    kind_id text references company_kinds (id),
    name text not null,
    branch_id uuid,
    team_id uuid,
    created_at timestamptz not null default now()
);

create table contacts (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    owner_id uuid not null references crm_users (id),
    first_name text,
    last_name text,
    merged_into_id uuid references contacts (id),
    branch_id uuid,
    team_id uuid,
    created_at timestamptz not null default now()
);

alter table crm_users
    add constraint crm_users_contact_id_fkey
    foreign key (contact_id) references contacts (id);

create table contact_type_assignments (
    tenant_id uuid not null references tenants (id),
    contact_id uuid not null references contacts (id) on delete restrict,
    type_id text not null references contact_types (id),
    is_primary boolean not null default false,
    primary key (tenant_id, contact_id, type_id)
);

create table contact_identifiers (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    contact_id uuid not null references contacts (id) on delete restrict,
    id_type text not null references identifier_types (id),
    value text not null,
    unique (tenant_id, id_type, value)
);

create table contact_affiliations (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    contact_id uuid not null references contacts (id) on delete restrict,
    company_id uuid not null references companies (id) on delete restrict,
    role text,
    is_primary boolean not null default false,
    valid_from date,
    valid_to date
);

create table pipelines (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    name text not null,
    sort_index int not null default 0
);

create table pipeline_stages (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    pipeline_id uuid not null references pipelines (id),
    code text not null,
    label text not null,
    sort_index int not null,
    is_closed boolean not null default false,
    is_won boolean not null default false
);

create table deals (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    owner_id uuid not null references crm_users (id),
    pipeline_id uuid not null references pipelines (id),
    stage_id uuid not null references pipeline_stages (id),
    name text not null,
    amount_cents bigint,
    encompass_id text,
    workspace_id text,
    source text,
    branch_id uuid,
    team_id uuid,
    created_at timestamptz not null default now(),
    updated_at timestamptz not null default now()
);

create table deal_parties (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    deal_id uuid not null references deals (id) on delete restrict,
    contact_id uuid not null references contacts (id) on delete restrict,
    role text not null references deal_party_roles (id),
    is_primary boolean not null default false,
    valid_from date,
    valid_to date,
    unique (tenant_id, deal_id, contact_id, role)
);

create table record_links (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    link_type_id text not null references link_types (id),
    from_object_type text not null references object_types (id),
    from_id uuid not null,
    to_object_type text not null references object_types (id),
    to_id uuid not null,
    valid_from date,
    valid_to date
);

create unique index record_links_active_uq
    on record_links (
        tenant_id, link_type_id,
        from_object_type, from_id,
        to_object_type, to_id
    )
    where valid_to is null;

create table deal_stage_events (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    deal_id uuid not null references deals (id),
    from_stage_id uuid references pipeline_stages (id),
    to_stage_id uuid not null references pipeline_stages (id),
    actor_user_id uuid references crm_users (id),
    at timestamptz not null default now()
);

create table activities (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    object_type text not null references object_types (id),
    object_id uuid not null,
    actor_user_id uuid references crm_users (id),
    kind text not null, -- note | task | stage_change | system
    body text,
    at timestamptz not null default now()
);

create table lists (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    name text not null,
    is_env boolean not null default false
);

create table list_members (
    tenant_id uuid not null references tenants (id),
    list_id uuid not null references lists (id),
    object_type text not null references object_types (id),
    object_id uuid not null,
    primary key (list_id, object_type, object_id)
);

create table saved_views (
    id uuid primary key default gen_random_uuid(),
    tenant_id uuid not null references tenants (id),
    owner_id uuid references crm_users (id),
    name text not null,
    object_type text not null references object_types (id),
    query jsonb not null default '{}'::jsonb
);

-- Tenant isolation only. Owner/branch/team stay in Acorn.
-- Table owner (local superuser) bypasses RLS; app role crm_app does not.
create or replace function current_tenant_id() returns uuid
language sql
stable
as $$
  select nullif(current_setting('app.tenant_id', true), '')::uuid;
$$;

do $$
declare
  t text;
begin
  foreach t in array array[
    'tenants',
    'crm_users',
    'companies',
    'contacts',
    'contact_type_assignments',
    'contact_identifiers',
    'contact_affiliations',
    'pipelines',
    'pipeline_stages',
    'deals',
    'deal_parties',
    'record_links',
    'deal_stage_events',
    'activities',
    'lists',
    'list_members',
    'saved_views'
  ]
  loop
    execute format('alter table %I enable row level security', t);
    execute format('alter table %I force row level security', t);
    execute format('drop policy if exists tenant_isolation on %I', t);
  end loop;
end
$$;

create policy tenant_isolation on tenants
  using (id = current_tenant_id());

create policy tenant_isolation on crm_users
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on companies
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on contacts
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on contact_type_assignments
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on contact_identifiers
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on contact_affiliations
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on pipelines
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on pipeline_stages
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on deals
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on deal_parties
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on record_links
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on deal_stage_events
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on activities
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on lists
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on list_members
  using (tenant_id = current_tenant_id());
create policy tenant_isolation on saved_views
  using (tenant_id = current_tenant_id());

do $$
begin
  if not exists (select 1 from pg_roles where rolname = 'crm_app') then
    create role crm_app login password 'crm_app';
  end if;
end
$$;

grant connect on database ardley_crm to crm_app;
grant usage on schema public to crm_app;
grant select, insert, update, delete on all tables in schema public to crm_app;
grant usage, select on all sequences in schema public to crm_app;
alter default privileges in schema public grant select, insert, update, delete on tables to crm_app;

-- Active org membership is unique; end a row (valid_to) before re-affiliating.
create unique index contact_affiliations_active_uq
    on contact_affiliations (tenant_id, contact_id, company_id)
    where valid_to is null;

-- PLACE team trees are trees (single parent). Recurse for company show later.
create or replace view company_tree as
with recursive nodes as (
    select
        c.id,
        c.tenant_id,
        c.parent_company_id,
        c.name,
        c.kind_id,
        0 as depth,
        array[c.id] as path
    from companies c
    where c.parent_company_id is null
    union all
    select
        child.id,
        child.tenant_id,
        child.parent_company_id,
        child.name,
        child.kind_id,
        parent.depth + 1,
        parent.path || child.id
    from companies child
    join nodes parent
      on child.parent_company_id = parent.id
     and child.tenant_id = parent.tenant_id
)
select id, tenant_id, parent_company_id, name, kind_id, depth, path
from nodes;

alter view company_tree set (security_invoker = true);
grant select on company_tree to crm_app;
