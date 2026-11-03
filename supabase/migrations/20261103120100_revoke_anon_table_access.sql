-- The anon role (requests made before sign-in) had every privilege on the CRM
-- tables, views and sequences. RLS has no anon policy so no row leaked, but
-- the grants needlessly exposed the whole schema to unauthenticated clients.
-- Before sign-in the app only reads public.init_state (see
-- src/components/atomic-crm/providers/supabase/authProvider.ts), which keeps
-- its anon grant.

revoke all on table
    public.companies,
    public.contacts,
    public.contact_notes,
    public.deals,
    public.deal_notes,
    public.sales,
    public.tags,
    public.tasks,
    public.configuration,
    public.favicons_excluded_domains,
    public.activity_log,
    public.companies_summary,
    public.contacts_summary
from anon;

revoke all on sequence
    public.companies_id_seq,
    public."contactNotes_id_seq",
    public.contacts_id_seq,
    public."dealNotes_id_seq",
    public.deals_id_seq,
    public.favicons_excluded_domains_id_seq,
    public.sales_id_seq,
    public.tags_id_seq,
    public.tasks_id_seq
from anon;

-- Functions are executable by PUBLIC (which anon inherits) unless revoked.
-- get_avatar_for_email() makes an outbound HTTP call, so anon could drive
-- database network I/O. anon keeps public.is_initialized() (read through
-- public.init_state) and the pure text helpers of 08_search.sql
-- (search_unaccent, search_document, search_query, search_attachment_titles),
-- which have no side effects.
revoke all on function
    public.get_avatar_for_email(text),
    public.get_domain_favicon(text),
    public.get_note_attachments_function_url(),
    public.handle_company_saved(),
    public.handle_contact_saved(),
    public.handle_tag_deleted(),
    public.lowercase_email_jsonb(),
    public.merge_contacts(bigint, bigint),
    public.set_sales_id_default()
from public, anon;

grant all on function public.handle_tag_deleted() to authenticated;
grant all on function public.handle_tag_deleted() to service_role;

-- Older projects still carry default privileges granting anon every new
-- object, which would reintroduce this exposure on the next create.
alter default privileges for role postgres in schema public revoke all on tables from anon;
alter default privileges for role postgres in schema public revoke all on sequences from anon;
-- PUBLIC's EXECUTE on functions is a database-wide default: a schema-scoped
-- statement cannot revoke it.
alter default privileges for role postgres revoke execute on functions from public;
alter default privileges for role postgres in schema public revoke all on functions from anon;
