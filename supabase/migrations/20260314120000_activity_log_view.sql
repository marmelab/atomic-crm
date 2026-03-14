-- Create a view that aggregates all activity events into a single, pageable list.
-- Each row represents one event (company created, contact created, note created, etc.)
-- sorted by date so PostgREST can paginate with Range headers.

create view "public"."activity_log"
    with (security_invoker=on)
    as
SELECT
    'company.' || c.id || '.created' as id,
    'company.created' as type,
    c.created_at as date,
    c.id as company_id,
    c.sales_id,
    to_json(c.*) as company,
    NULL::json as contact,
    NULL::json as deal,
    NULL::json as contact_note,
    NULL::json as deal_note
FROM companies c
UNION ALL
SELECT
    'contact.' || co.id || '.created',
    'contact.created',
    co.first_seen,
    co.company_id,
    co.sales_id,
    NULL::json,
    to_json(co.*),
    NULL::json,
    NULL::json,
    NULL::json
FROM contacts co
UNION ALL
SELECT
    'contactNote.' || cn.id || '.created',
    'contactNote.created',
    cn.date,
    co.company_id,
    cn.sales_id,
    NULL::json,
    NULL::json,
    NULL::json,
    to_json(cn.*),
    NULL::json
FROM contact_notes cn
LEFT JOIN contacts co ON co.id = cn.contact_id
UNION ALL
SELECT
    'deal.' || d.id || '.created',
    'deal.created',
    d.created_at,
    d.company_id,
    d.sales_id,
    NULL::json,
    NULL::json,
    to_json(d.*),
    NULL::json,
    NULL::json
FROM deals d
UNION ALL
SELECT
    'dealNote.' || dn.id || '.created',
    'dealNote.created',
    dn.date,
    d.company_id,
    dn.sales_id,
    NULL::json,
    NULL::json,
    NULL::json,
    NULL::json,
    to_json(dn.*)
FROM deal_notes dn
LEFT JOIN deals d ON d.id = dn.deal_id;

-- Indexes to support filtering the view by company_id efficiently
CREATE INDEX ON contacts (company_id);
CREATE INDEX ON deals (company_id);
CREATE INDEX ON contact_notes (contact_id);
CREATE INDEX ON deal_notes (deal_id);
