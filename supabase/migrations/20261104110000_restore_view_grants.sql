-- 20261102160000 dropped and recreated the summary views. That cleared their
-- grants. 20261102160200 revoked anon but never gave authenticated back, so
-- a signed-in user gets "permission denied for view contacts_summary" and the
-- app signs them out.
grant all on table public.contacts_summary to authenticated;
grant all on table public.contacts_summary to service_role;
grant all on table public.companies_summary to authenticated;
grant all on table public.companies_summary to service_role;
grant all on table public.activity_log to authenticated;
grant all on table public.activity_log to service_role;

revoke all on table public.contacts_summary from anon;
revoke all on table public.companies_summary from anon;
revoke all on table public.activity_log from anon;
