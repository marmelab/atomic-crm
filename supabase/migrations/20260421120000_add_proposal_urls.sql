alter table public.deals
    add column if not exists proposal_edit_url text,
    add column if not exists proposal_public_url text;

-- Refresh deals_summary so the view picks up the new columns
-- (it uses d.* which is expanded at view creation time).
create or replace view public.deals_summary with (security_invoker = on) as
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
