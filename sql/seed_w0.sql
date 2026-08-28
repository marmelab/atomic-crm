-- W0 seed: catalogs + Woodley 100004 + Envoy 100081.
-- Tenant UUIDs: uuid5(uuid5(DNS, 'ardley-crm.tenants'), customer_id)

insert into object_types (id) values
    ('contact'),
    ('company'),
    ('deal')
on conflict do nothing;

insert into identifier_types (id) values
    ('nmls'),
    ('dre'),
    ('mls'),
    ('email'),
    ('phone')
on conflict do nothing;

insert into deal_party_roles (id) values
    ('borrower'),
    ('co_borrower'),
    ('referring_agent'),
    ('loan_officer')
on conflict do nothing;

insert into contact_types (id, label, is_env) values
    ('borrower', 'Borrower', true),
    ('potential_borrower', 'Potential borrower', true),
    ('real_estate_agent', 'Real estate agent', true),
    ('loan_officer', 'Loan officer', true),
    ('employee', 'Employee', true),
    ('recruit', 'Recruit', true)
on conflict do nothing;

insert into company_kinds (id, label) values
    ('brokerage', 'Brokerage'),
    ('place_team', 'PLACE team'),
    ('builder', 'Builder'),
    ('employer', 'Employer'),
    ('lender_branch', 'Lender branch')
on conflict do nothing;

insert into link_types (id, directed, from_object_type, to_object_type) values
    ('spouse', false, 'contact', 'contact'),
    ('paired_agent', false, 'contact', 'contact'),
    ('coach_of', true, 'contact', 'contact'),
    ('referred_by', true, 'contact', 'contact'),
    ('related_deal', true, 'deal', 'deal')
on conflict do nothing;

insert into tenants (id, ardley_customer_id, slug, name) values
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '100004',
        'woodley',
        'Woodley'
    ),
    (
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        '100081',
        'envoy',
        'Envoy Mortgage'
    )
on conflict (ardley_customer_id) do nothing;

insert into crm_users (id, tenant_id, cognito_sub, email) values
    (
        '11111111-1111-1111-1111-111111111111',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        'w0-smoke-woodley-lo',
        'woodley.lo@example.test'
    ),
    (
        '22222222-2222-2222-2222-222222222222',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        'w0-smoke-envoy-lo',
        'envoy.lo@example.test'
    )
on conflict (cognito_sub) do nothing;

insert into contacts (id, tenant_id, owner_id, first_name, last_name) values
    (
        'aaaaaaaa-aaaa-aaaa-aaaa-aaaaaaaaaaaa',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100004'),
        '11111111-1111-1111-1111-111111111111',
        'Willow',
        'Woodley'
    ),
    (
        'bbbbbbbb-bbbb-bbbb-bbbb-bbbbbbbbbbbb',
        uuid_generate_v5(uuid_generate_v5(uuid_ns_dns(), 'ardley-crm.tenants'), '100081'),
        '22222222-2222-2222-2222-222222222222',
        'Ellis',
        'Envoy'
    )
on conflict (id) do nothing;
