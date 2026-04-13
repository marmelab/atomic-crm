-- Add company_name and company_name_search to the deals_summary view so that
-- the search box on the Kanban board can match deals by their company name.
--
-- Previously the view only joined contacts (for contact_names), but not
-- companies. This meant typing a company name in the search box always
-- returned zero results even though the deal was clearly linked to that company.
--
-- Note: CREATE OR REPLACE VIEW cannot reorder existing columns, so we must
-- DROP and recreate. The column order here must also match 03_views.sql.

drop view if exists public.deals_summary;

create view public.deals_summary
  with (security_invoker = on)
  as
select
    d.*,
    comp.name                                                                                          as company_name,
    lower(immutable_unaccent(coalesce(comp.name, '')))                                                 as company_name_search,
    coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), '')                               as contact_names,
    lower(immutable_unaccent(coalesce(string_agg((c.first_name || ' ' || c.last_name), ' '), '')))    as contact_names_search
from public.deals d
    left join public.contacts c on c.id = any(d.contact_ids)
    left join public.companies comp on comp.id = d.company_id
group by d.id, comp.name;

-- Re-apply grants (DROP VIEW resets them)
revoke all on table public.deals_summary from anon;
grant all on table public.deals_summary to authenticated;
grant all on table public.deals_summary to service_role;
