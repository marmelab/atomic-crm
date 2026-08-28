-- W1 seed: one Woodley loan triangle + pipelines. Envoy stays one contact.
-- Fixed UUIDs so isolation scripts can name rows. Fake PII only.

-- Woodley pipelines (Envoy-shaped names, Woodley copy)
insert into pipelines (id, tenant_id, name, sort_index) values
    (
        'c1000001-0001-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'Lead - Active',
        10
    ),
    (
        'c1000001-0001-4000-8000-000000000004',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'In Process Loans',
        40
    )
on conflict (id) do nothing;

insert into pipeline_stages (id, tenant_id, pipeline_id, code, label, sort_index, is_closed, is_won) values
    (
        'c1000001-0001-4000-8000-000000000011',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'c1000001-0001-4000-8000-000000000001',
        '02-lead-attempted',
        '02 - Lead Attempted',
        2,
        false,
        false
    ),
    (
        'c1000001-0001-4000-8000-000000000041',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'c1000001-0001-4000-8000-000000000004',
        '04-app-started',
        '04 - App Started',
        4,
        false,
        false
    )
on conflict (id) do nothing;

-- Nested companies: brokerage → PLACE team
insert into companies (id, tenant_id, owner_id, parent_company_id, kind_id, name) values
    (
        'c1000002-0002-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        null,
        'brokerage',
        'Woodley Realty'
    ),
    (
        'c1000002-0002-4000-8000-000000000002',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'c1000002-0002-4000-8000-000000000001',
        'place_team',
        'Agents with a Grin'
    )
on conflict (id) do nothing;

-- Humans: borrower, spouse, referring agent, LO (same person as crm_users)
insert into contacts (id, tenant_id, owner_id, first_name, last_name) values
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Sam',
        'Spouse'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Avery',
        'Agent'
    ),
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Phil',
        'Officer'
    )
on conflict (id) do nothing;

update crm_users
set contact_id = 'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad'
where id = '11111111-1111-1111-1111-111111111111'
  and contact_id is null;

insert into contact_type_assignments (tenant_id, contact_id, type_id, is_primary) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'borrower',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
        'borrower',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        'real_estate_agent',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        'loan_officer',
        true
    )
on conflict do nothing;

insert into contact_identifiers (tenant_id, contact_id, id_type, value) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        'nmls',
        '999001'
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        'dre',
        'DRE-404040'
    )
on conflict do nothing;

insert into contact_affiliations (tenant_id, contact_id, company_id, role, is_primary) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        'c1000002-0002-4000-8000-000000000002',
        'agent',
        true
    )
on conflict do nothing;

insert into record_links (
    tenant_id, link_type_id,
    from_object_type, from_id, to_object_type, to_id
) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'spouse',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'contact',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab'
    )
on conflict do nothing;

insert into deals (
    id, tenant_id, owner_id, pipeline_id, stage_id, name, amount_cents, source
) values
    (
        'd1000003-0003-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'c1000001-0001-4000-8000-000000000004',
        'c1000001-0001-4000-8000-000000000041',
        'Willow purchase',
        42500000,
        'walkthrough'
    )
on conflict (id) do nothing;

insert into deal_parties (tenant_id, deal_id, contact_id, role, is_primary) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        'borrower',
        true
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaab',
        'co_borrower',
        false
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaac',
        'referring_agent',
        false
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000001',
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaad',
        'loan_officer',
        false
    )
on conflict do nothing;

insert into deal_stage_events (tenant_id, deal_id, from_stage_id, to_stage_id, actor_user_id)
values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'd1000003-0003-4000-8000-000000000001',
        null,
        'c1000001-0001-4000-8000-000000000041',
        '11111111-1111-1111-1111-111111111111'
    );

insert into activities (tenant_id, object_type, object_id, actor_user_id, kind, body)
values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'deal',
        'd1000003-0003-4000-8000-000000000001',
        '11111111-1111-1111-1111-111111111111',
        'stage_change',
        'Opened on In Process / 04 - App Started'
    );

-- Tiny Envoy company so isolation can name it; no Woodley leak.
insert into companies (id, tenant_id, owner_id, kind_id, name) values
    (
        'c1000081-0002-4000-8000-000000000001',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        '22222222-2222-2222-2222-222222222222',
        'lender_branch',
        'Envoy Isolation Branch'
    )
on conflict (id) do nothing;
