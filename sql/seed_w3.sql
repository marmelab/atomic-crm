-- W3 seed: enough Woodley story to walk saved views. Fake PII only.
-- Keeps W1 triangle ids. Adds a second triangle, paired agents, recruiting.

insert into deal_party_roles (id) values ('recruit')
on conflict do nothing;

-- Recruiting pipeline (second book next to In Process)
insert into pipelines (id, tenant_id, name, sort_index) values
    (
        'c1000001-0001-4000-8000-000000000007',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'Recruiting - All Roles',
        70
    )
on conflict (id) do nothing;

insert into pipeline_stages (id, tenant_id, pipeline_id, code, label, sort_index, is_closed, is_won) values
    (
        'c1000001-0001-4000-8000-000000000071',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'c1000001-0001-4000-8000-000000000007',
        '03c-team',
        '03c Team',
        3,
        false,
        false
    ),
    (
        'c1000001-0001-4000-8000-000000000072',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'c1000001-0001-4000-8000-000000000007',
        '04c-commit',
        '04c Commit | Application',
        4,
        false,
        false
    )
on conflict (id) do nothing;

-- Second team so company show is not a single child
insert into companies (id, tenant_id, owner_id, parent_company_id, kind_id, name) values
    (
        'c1000002-0002-4000-8000-000000000003',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'c1000002-0002-4000-8000-000000000001',
        'place_team',
        'Harborline Homes'
    )
on conflict (id) do nothing;

insert into contacts (id, tenant_id, owner_id, first_name, last_name) values
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Riley',
        'Agent'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaf',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Blair',
        'Borrower'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab0',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Casey',
        'Spouse'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Morgan',
        'Recruit'
    )
on conflict (id) do nothing;

insert into contact_type_assignments (tenant_id, contact_id, type_id, is_primary) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae',
        'real_estate_agent',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaf',
        'borrower',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab0',
        'borrower',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1',
        'recruit',
        true
    )
on conflict do nothing;

insert into contact_identifiers (tenant_id, contact_id, id_type, value) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae',
        'nmls',
        '999002'
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1',
        'nmls',
        '888100'
    )
on conflict do nothing;

insert into contact_affiliations (tenant_id, contact_id, company_id, role, is_primary) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae',
        'c1000002-0002-4000-8000-000000000002',
        'agent',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1',
        'c1000002-0002-4000-8000-000000000003',
        'recruit',
        true
    )
on conflict do nothing;

-- Symmetric paired_agent: one row each. Phil (LO) ↔ Avery, Phil ↔ Riley.
insert into record_links (
    tenant_id, link_type_id, from_object_type, from_id, to_object_type, to_id
) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'paired_agent',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac'
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'paired_agent',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae'
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'spouse',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaf',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab0'
    )
on conflict do nothing;

insert into deals (
    id, tenant_id, owner_id, pipeline_id, stage_id, name, amount_cents, source
) values
    (
        'd1000003-0003-4000-8000-000000000002',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'c1000001-0001-4000-8000-000000000004',
        'c1000001-0001-4000-8000-000000000042',
        'Blair refinance',
        31000000,
        'walkthrough'
    ),
    (
        'd1000003-0003-4000-8000-000000000003',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'c1000001-0001-4000-8000-000000000007',
        'c1000001-0001-4000-8000-000000000071',
        'Morgan LO hire',
        null,
        'walkthrough'
    )
on conflict (id) do nothing;

insert into deal_parties (tenant_id, deal_id, contact_id, role, is_primary) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaf',
        'borrower',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab0',
        'co_borrower',
        false
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae',
        'referring_agent',
        false
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000002',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        'loan_officer',
        false
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000003',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaab1',
        'recruit',
        true
    )
on conflict do nothing;

-- ENV list = explicit membership. View = stored query.
insert into lists (id, tenant_id, name, is_env) values
    (
        'a1000004-0004-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'My Paired Agents ENV',
        true
    )
on conflict (id) do nothing;

insert into list_members (tenant_id, list_id, object_type, object_id) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'a1000004-0004-4000-8000-000000000001',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac'
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'a1000004-0004-4000-8000-000000000001',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaae'
    )
on conflict do nothing;

insert into saved_views (id, tenant_id, owner_id, name, object_type, query) values
    (
        'a1000005-0005-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'My Borrowers',
        'contact',
        '{"kind":"contacts_by_type","type_id":"borrower"}'::jsonb
    ),
    (
        'a1000005-0005-4000-8000-000000000002',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'My Paired Agents',
        'contact',
        '{"kind":"list","list_id":"a1000004-0004-4000-8000-000000000001"}'::jsonb
    ),
    (
        'a1000005-0005-4000-8000-000000000003',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'In-process loans',
        'deal',
        '{"kind":"deals_by_pipeline","pipeline_id":"c1000001-0001-4000-8000-000000000004"}'::jsonb
    ),
    (
        'a1000005-0005-4000-8000-000000000004',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Recruiting',
        'deal',
        '{"kind":"deals_by_pipeline","pipeline_id":"c1000001-0001-4000-8000-000000000007"}'::jsonb
    )
on conflict (id) do nothing;

-- Envoy: a second contact + a deal so isolation search is not one name.
insert into pipelines (id, tenant_id, name, sort_index) values
    (
        'c1000081-0001-4000-8000-000000000004',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        'In Process Loans',
        40
    )
on conflict (id) do nothing;

insert into pipeline_stages (id, tenant_id, pipeline_id, code, label, sort_index) values
    (
        'c1000081-0001-4000-8000-000000000041',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        'c1000081-0001-4000-8000-000000000004',
        '04-app-started',
        '04 - App Started',
        4
    )
on conflict (id) do nothing;

insert into contacts (id, tenant_id, owner_id, first_name, last_name) values
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbe',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        '22222222-2222-2222-2222-222222222222',
        'Finn',
        'Envoy'
    )
on conflict (id) do nothing;

insert into deals (
    id, tenant_id, owner_id, pipeline_id, stage_id, name, amount_cents
) values
    (
        'd1000081-0003-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        '22222222-2222-2222-2222-222222222222',
        'c1000081-0001-4000-8000-000000000004',
        'c1000081-0001-4000-8000-000000000041',
        'Ellis isolation loan',
        10000000
    )
on conflict (id) do nothing;
