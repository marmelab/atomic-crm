-- Corrective migration: restore company_name_search in contacts_summary.
--
-- Root cause: migrations 20260307120000 and 20260309112831 were applied
-- out-of-order (pushed to remote after 20260317120000 was already there).
-- Both recreated contacts_summary without company_name_search, overwriting
-- the correct definition from 20260317120000_accent_insensitive_search.sql.
--
-- This migration restores the canonical view definition, combining:
--   • company_name_search (from 20260317120000)
--   • nb_tasks FILTER (WHERE done_date IS NULL) (from 20260307120000)
--   • security_invoker = on (from 20260309112831)

drop view if exists public.contacts_summary;

create view public.contacts_summary
  with (security_invoker = on)
  as
  select
    co.*,
    c.name                                                        as company_name,
    lower(immutable_unaccent(coalesce(c.name, '')))               as company_name_search,
    jsonb_path_query_array(co.email_jsonb, '$[*].email')::text    as email_fts,
    jsonb_path_query_array(co.phone_jsonb, '$[*].number')::text   as phone_fts,
    count(distinct t.id) filter (where t.done_date is null)       as nb_tasks
  from public.contacts co
  left join public.tasks t    on co.id = t.contact_id
  left join public.companies c on co.company_id = c.id
  group by co.id, c.name;

revoke all on table public.contacts_summary from anon;
grant select on table public.contacts_summary to authenticated;
grant select on table public.contacts_summary to service_role;
