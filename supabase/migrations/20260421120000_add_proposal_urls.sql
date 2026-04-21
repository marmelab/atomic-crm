alter table public.deals
    add column if not exists proposal_edit_url text,
    add column if not exists proposal_public_url text;

-- Refresh deals_summary so the view picks up the new columns.
-- Must DROP+CREATE (not CREATE OR REPLACE) because d.* introduces new
-- columns in the middle of the select list, which Postgres rejects as
-- a column reorder.
drop view if exists public.deals_summary;
create view public.deals_summary with (security_invoker = on) as
select
    d.*,
    comp.name                                                                                                          as company_name,
    replace(lower(immutable_unaccent(coalesce(comp.name, ''))), ' ', '')                                                as company_name_search,
    coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), '')                                                as contact_names,
    replace(lower(immutable_unaccent(coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), ''))), ' ', '')    as contact_names_search
from public.deals d
    left join public.contacts c on c.id = any(d.contact_ids)
    left join public.companies comp on comp.id = d.company_id
group by d.id, comp.name;
