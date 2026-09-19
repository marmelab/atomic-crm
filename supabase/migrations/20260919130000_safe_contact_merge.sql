-- Merging two Contacts must not lose anything.
--
-- The old merge deleted the losing Contact, and every dependent table
-- cascades from contacts — Deals, Sales Calls, Tasks, sessions, notes,
-- waitlist entries, Stripe relations. So "merge" meant "move some rows and
-- destroy whatever was missed". Slice 0 disabled it rather than repair it
-- in place, and this is the repair.
--
-- The shape here is deliberate:
--
--   Every child row is repointed EXPLICITLY, table by table. Nothing
--   relies on a cascade, because a cascade is what deletion does when it
--   cannot be asked.
--
--   The losing Contact is NOT deleted. It keeps its row and gains a
--   pointer to the Contact it became, so its history stays readable and an
--   old link still resolves to a person. Contact deletion remains
--   unavailable; this does not reopen it.
--
--   Domain entities are never combined. A merge says "these two records
--   are the same human". It does not say two Opportunities are one sales
--   attempt, or two Enrollments one programme. Those stay separate, now
--   owned by one person.
--
--   Ambiguity refuses. contact_merge_conflicts() decides whether the
--   evidence is unambiguous; anything it reports has to be acknowledged in
--   writing by whoever is asking.

begin;

create or replace function public.merge_contacts_safely(
  p_source bigint,
  p_destination bigint,
  p_actor text,
  p_evidence text,
  -- The conflict codes the caller has seen and accepted. A merge with
  -- unacknowledged conflicts refuses: the point is that a person decided,
  -- not that the database was talked round.
  p_acknowledged_conflicts text[] default '{}'
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_unacknowledged text[];
  v_moved jsonb := '{}'::jsonb;
  v_n bigint;
  v_merge_id bigint;
begin
  if p_actor is null or btrim(p_actor) = '' then
    raise exception 'a merge must record who performed it';
  end if;
  if p_evidence is null or btrim(p_evidence) = '' then
    raise exception 'a merge must record the evidence it rests on';
  end if;

  -- Lock both, lowest id first, so two merges cannot interleave.
  perform 1 from contacts where id in (p_source, p_destination)
   order by id for update;

  if not exists (select 1 from contacts where id = p_source) then
    raise exception 'source Contact % does not exist', p_source;
  end if;
  if not exists (select 1 from contacts where id = p_destination) then
    raise exception 'destination Contact % does not exist', p_destination;
  end if;

  select coalesce(array_agg(code), '{}')
    into v_unacknowledged
    from public.contact_merge_conflicts(p_source, p_destination)
   where code <> all (coalesce(p_acknowledged_conflicts, '{}'));

  if array_length(v_unacknowledged, 1) is not null then
    raise exception 'merge refused: unacknowledged conflict(s) %', v_unacknowledged
      using hint = 'Review each with contact_merge_conflicts(), then pass the codes you accept as p_acknowledged_conflicts.';
  end if;

  -- ---- Every child, named explicitly. ----
  -- Applications carry their own Opportunity agreement check, so they are
  -- moved with their Opportunities rather than independently.
  update deals set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('deals', v_n);

  update applications set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('applications', v_n);

  update sales_calls set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('sales_calls', v_n);

  update client_sessions set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('client_sessions', v_n);

  update tasks set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('tasks', v_n);

  update contact_notes set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('contact_notes', v_n);

  update waitlist_entries set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('waitlist_entries', v_n);

  update waitlist_invitations set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('waitlist_invitations', v_n);

  -- Stripe relations move as evidence. The unique key is the Stripe
  -- customer id, so nothing can be duplicated by this; is_primary is left
  -- alone rather than guessed at, and payment truth is untouched.
  update contact_stripe_customers set contact_id = p_destination where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('contact_stripe_customers', v_n);

  -- Provider identities move too; their uniqueness is on the provider id,
  -- so a genuine duplicate identity would already have been a conflict.
  update contact_external_identities set contact_id = p_destination, updated_at = now()
   where contact_id = p_source;
  get diagnostics v_n = row_count; v_moved := v_moved || jsonb_build_object('external_identities', v_n);

  -- historical_import_records is deliberately NOT touched. It is keyed by
  -- (entity_table, entity_id) and records how a particular ROW was
  -- imported, not who a person is. The source Contact row still exists —
  -- this merge does not delete it — so its provenance stays attached to
  -- something real, and moving it would collide with the destination's
  -- own row on that unique key.

  -- ---- The surviving Contact keeps the earliest evidence. ----
  -- first_seen is "when did this person first appear", so the earlier of
  -- the two is the true answer; last_seen is the later.
  update contacts d
     set first_seen = least(d.first_seen, s.first_seen),
         last_seen = greatest(d.last_seen, s.last_seen)
    from contacts s
   where d.id = p_destination and s.id = p_source;

  -- ---- The losing Contact stays, and says what it became. ----
  update contacts set merged_into_contact_id = p_destination where id = p_source;

  insert into contact_merges
    (source_contact_id, destination_contact_id, actor, evidence, moved_counts)
  values (p_source, p_destination, p_actor, p_evidence, v_moved)
  returning id into v_merge_id;

  return jsonb_build_object(
    'merge_id', v_merge_id,
    'source_contact_id', p_source,
    'destination_contact_id', p_destination,
    'moved', v_moved
  );
end;
$$;

comment on function public.merge_contacts_safely(bigint, bigint, text, text, text[]) is
  'Moves every dependent record from one Contact to another, explicitly, table by table, and records why. Never deletes: the source keeps its row and points at what it became. Refuses while any conflict is unacknowledged. Combines no Opportunities, Enrollments or payments — a merge is about identity, not about the domain.';

revoke all on function public.merge_contacts_safely(bigint, bigint, text, text, text[]) from public, anon;

-- ---------------------------------------------------------------------
-- The one way an integration says "this provider saw this person"
-- ---------------------------------------------------------------------
-- Instagram and Gmail will both call this. It is deliberately dull: it
-- resolves, it attaches, or it declines. It never merges, never guesses
-- from a handle, and never creates an Opportunity — a DM is not a sale.
create or replace function public.record_external_identity(
  p_provider text,
  p_provider_account_id text,
  p_external_user_id text,
  p_display_identifier text default null,
  p_metadata jsonb default '{}'::jsonb,
  p_observed_at timestamptz default now(),
  -- A deterministic address to reconcile by, when the provider gives one.
  -- Only an EXACT normalized match is ever used.
  p_email text default null
) returns jsonb
language plpgsql
security definer
set search_path to 'public'
as $$
declare
  v_existing contact_external_identities%rowtype;
  v_contact_id bigint;
  v_matches int;
begin
  if p_external_user_id is null or btrim(p_external_user_id) = '' then
    raise exception 'an external identity needs the provider''s own id, never a handle';
  end if;

  -- A. Already known. The handle may have changed; that is metadata.
  select * into v_existing from contact_external_identities
   where provider = p_provider
     and provider_account_id is not distinct from p_provider_account_id
     and external_user_id = p_external_user_id;

  if found then
    update contact_external_identities
       set display_identifier = coalesce(p_display_identifier, display_identifier),
           metadata = metadata || coalesce(p_metadata, '{}'::jsonb),
           first_seen_at = least(coalesce(first_seen_at, p_observed_at), p_observed_at),
           last_seen_at = greatest(coalesce(last_seen_at, p_observed_at), p_observed_at),
           updated_at = now()
     where id = v_existing.id;

    -- Follow a merge rather than resurrecting a merged-away Contact.
    select coalesce(c.merged_into_contact_id, c.id) into v_contact_id
      from contacts c where c.id = v_existing.contact_id;

    return jsonb_build_object('status', 'known', 'contact_id', v_contact_id,
                              'identity_id', v_existing.id);
  end if;

  -- B. Not known, but an exact address match names exactly one Contact.
  if public.normalize_email(p_email) is not null then
    select count(distinct contact_id) into v_matches
      from contact_email_addresses
     where normalized_email = public.normalize_email(p_email);

    if v_matches = 1 then
      select coalesce(c.merged_into_contact_id, c.id) into v_contact_id
        from contact_email_addresses a
        join contacts c on c.id = a.contact_id
       where a.normalized_email = public.normalize_email(p_email)
       limit 1;

      insert into contact_external_identities
        (contact_id, provider, provider_account_id, external_user_id,
         display_identifier, metadata, first_seen_at, last_seen_at)
      values (v_contact_id, p_provider, p_provider_account_id, p_external_user_id,
              p_display_identifier, coalesce(p_metadata, '{}'::jsonb),
              p_observed_at, p_observed_at)
      returning id into v_existing.id;

      return jsonb_build_object('status', 'linked_by_email', 'contact_id', v_contact_id,
                                'identity_id', v_existing.id);
    end if;

    -- D. The address names more than one person. Refuse, loudly.
    if v_matches > 1 then
      return jsonb_build_object('status', 'ambiguous',
        'reason', format('%s Contacts hold that address; a person must decide', v_matches));
    end if;
  end if;

  -- C. Nothing deterministic to attach to. The caller decides whether its
  --    integration rules justify creating a Contact; this will not do it
  --    on a handle's say-so.
  return jsonb_build_object('status', 'unresolved',
    'reason', 'no existing identity and no exact email match');
end;
$$;

comment on function public.record_external_identity(text, text, text, text, jsonb, timestamptz, text) is
  'The single entry point for "provider P, account A, user id X was observed". Returns known / linked_by_email / ambiguous / unresolved. Never merges Contacts, never matches on a handle or a name, and never creates an Opportunity.';

revoke all on function public.record_external_identity(text, text, text, text, jsonb, timestamptz, text) from public, anon;

-- ---------------------------------------------------------------------
-- Prove it landed
-- ---------------------------------------------------------------------
do $$
declare v_missing text := '';
begin
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='contact_external_identities') then
    v_missing := v_missing || 'contact_external_identities '; end if;
  if not exists (select 1 from information_schema.tables
                  where table_schema='public' and table_name='contact_merges') then
    v_missing := v_missing || 'contact_merges '; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='merge_contacts_safely') then
    v_missing := v_missing || 'merge_contacts_safely() '; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='record_external_identity') then
    v_missing := v_missing || 'record_external_identity() '; end if;
  if not exists (select 1 from pg_proc p join pg_namespace n on n.oid=p.pronamespace
                  where n.nspname='public' and p.proname='contact_merge_conflicts') then
    v_missing := v_missing || 'contact_merge_conflicts() '; end if;
  if v_missing <> '' then
    raise exception 'contact identity structure did not land: %', v_missing;
  end if;
end $$;

commit;
