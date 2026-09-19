-- Finding a person by what you actually remember about them.
--
-- Contact search covered name, company, title, email, phone and
-- background. It could not find somebody by the handle they message from,
-- which is exactly how Leif will know an Instagram prospect, and it could
-- not see the free-text identifiers note either.
--
-- The handle is search metadata and nothing more. It is never a key, never
-- a merge signal, and a person who changes it stays one person — the
-- immutable provider id in contact_external_identities is what identifies
-- them. This only makes the label they are known by findable.
--
-- merged_into_contact_id comes along so a merged-away Contact can be kept
-- out of lists without a second query.

begin;

create or replace view public.contacts_summary with (security_invoker = on) as
SELECT co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath)::text AS email_fts,
    jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath)::text AS phone_fts,
    c.name AS company_name,
    count(DISTINCT t.id) FILTER (WHERE t.done_date IS NULL) AS nb_tasks,
    co.sales_eligibility,
    COALESCE(array_agg(DISTINCT d.offer_id) FILTER (WHERE d.offer_id IS NOT NULL), '{}'::bigint[]) AS offer_ids,
    bool_or(e.status = ANY (ARRAY['onboarding'::text, 'active'::text])) AS is_current_client,
    bool_or(e.status = ANY (ARRAY['offboarding'::text, 'completed'::text])) AS is_past_client,
    bool_or(app.id IS NOT NULL) AS has_applied,
    bool_or(w.status = ANY (ARRAY['waiting'::text, 'invited'::text])) AS is_on_waitlist,
    bool_or(d.outcome = 'nurture'::text AND d.archived_at IS NULL) AS has_nurture_deal,
    co.identifiers,
    co.merged_into_contact_id,
    ( SELECT string_agg(DISTINCT i.display_identifier, ' ')
        FROM contact_external_identities i
       WHERE i.contact_id = co.id AND i.display_identifier IS NOT NULL) AS external_identifiers_fts
   FROM contacts co
     LEFT JOIN tasks t ON co.id = t.contact_id
     LEFT JOIN companies c ON co.company_id = c.id
     LEFT JOIN deals d ON d.contact_id = co.id
     LEFT JOIN enrollments e ON e.opportunity_id = d.id
     LEFT JOIN applications app ON app.opportunity_id = d.id
     LEFT JOIN waitlist_entries w ON w.contact_id = co.id
  GROUP BY co.id, c.name;

comment on view public.contacts_summary is
  'Contacts with their derived relationship columns. external_identifiers_fts aggregates the display handles/addresses providers know a person by, for SEARCH ONLY — identity lives on the immutable provider id, never on a handle.';

grant select on public.contacts_summary to authenticated;

do $$
begin
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='contacts_summary'
                    and column_name='external_identifiers_fts') then
    raise exception 'contacts_summary is missing external_identifiers_fts';
  end if;
  if not exists (select 1 from information_schema.columns
                  where table_schema='public' and table_name='contacts_summary'
                    and column_name='merged_into_contact_id') then
    raise exception 'contacts_summary is missing merged_into_contact_id';
  end if;
end $$;

commit;
