-- The two destructive Contact paths the application layer could not close.
--
-- Slice 0 disabled the merge dialog, the merge Edge Function and every
-- Contact-delete affordance in the UI, and made both data providers refuse.
-- Two paths survived underneath all of that, because neither goes through
-- application code at all:
--
--   1. public.merge_contacts(bigint, bigint) is still callable at
--      POST /rest/v1/rpc/merge_contacts by anybody holding a signed-in
--      token. It repoints tasks, contact_notes and deals, then deletes the
--      losing Contact — taking client_sessions, contact_stripe_customers,
--      sales_calls and waitlist_entries with it through the foreign keys,
--      or aborting partway for anybody who ever applied. Nothing in the
--      application has ever called it: the production data provider always
--      went through the Edge Function.
--
--   2. "Contact Delete Policy" is `using (true)` for authenticated, beside
--      a DELETE table grant, so DELETE /rest/v1/contacts?id=eq.N cascades
--      away the same seven tables with no merge involved.
--
-- Neither has ever run on real data — every historical merge was a
-- deliberate SQL migration — which is why live integrity is clean. Closed
-- here rather than left resting on that.
--
-- The function is kept, not dropped: it is the record of what the merge
-- did, and the starting point for the transactional merge that replaces it.
-- Administrative access stays with the owner, which is the role every real
-- merge has actually used.

begin;

-- ---------------------------------------------------------------------
-- 1. The merge primitive stops being callable over the API
-- ---------------------------------------------------------------------
-- proacl is NULL on this function, which in Postgres means the default:
-- EXECUTE to PUBLIC. So revoking from anon and authenticated alone would
-- change nothing — PUBLIC is the grant that has to go first.
revoke all on function public.merge_contacts(bigint, bigint) from public;
revoke all on function public.merge_contacts(bigint, bigint) from anon;
revoke all on function public.merge_contacts(bigint, bigint) from authenticated;

-- service_role is revoked too, deliberately. The application does not use
-- this function from any role, and leaving it callable by the service key
-- would keep the destructive primitive reachable from every Edge Function.
-- An administrator who genuinely needs it runs it as the owner, in SQL —
-- which is how all eleven historical merges were actually performed.
revoke all on function public.merge_contacts(bigint, bigint) from service_role;

-- ---------------------------------------------------------------------
-- 2. Contacts stop being deletable over the API
-- ---------------------------------------------------------------------
drop policy if exists "Contact Delete Policy" on public.contacts;

revoke delete on table public.contacts from authenticated;
-- Already revoked by 20260902020000; restated so this migration is the one
-- place that describes the whole posture rather than half of it.
revoke delete on table public.contacts from anon;

-- service_role keeps DELETE: it bypasses RLS and is the role the recovery
-- and import tooling runs as. Read, insert and update are untouched for
-- everyone — this closes deletion, not the Contacts resource.

comment on table public.contacts is
  'Contacts are not deletable through the API. DELETE cascades into client_sessions, contact_notes, contact_stripe_customers, deals, sales_calls, tasks and waitlist_entries, and is blocked outright by applications and waitlist_invitations. Deletion returns as an archive, or alongside the transactional merge that replaces public.merge_contacts.';

-- ---------------------------------------------------------------------
-- 3. Prove it, rather than assume the revokes landed
-- ---------------------------------------------------------------------
do $$
declare
  v_role text;
  v_policies int;
begin
  foreach v_role in array array['anon', 'authenticated', 'service_role', 'public']
  loop
    if has_function_privilege(
         v_role, 'public.merge_contacts(bigint, bigint)', 'execute') then
      raise exception '% can still execute merge_contacts', v_role;
    end if;
  end loop;

  foreach v_role in array array['anon', 'authenticated']
  loop
    if has_table_privilege(v_role, 'public.contacts', 'delete') then
      raise exception '% can still delete contacts', v_role;
    end if;
    -- The rail is deletion only. Everything else must still work.
    if not has_table_privilege('authenticated', 'public.contacts', 'select') then
      raise exception 'authenticated lost SELECT on contacts';
    end if;
    if not has_table_privilege('authenticated', 'public.contacts', 'update') then
      raise exception 'authenticated lost UPDATE on contacts';
    end if;
  end loop;

  select count(*) into v_policies
  from pg_policy where polrelid = 'public.contacts'::regclass and polcmd = 'd';
  if v_policies <> 0 then
    raise exception '% delete policies survive on contacts', v_policies;
  end if;

  -- Read, insert and update policies must all still be there.
  select count(*) into v_policies
  from pg_policy where polrelid = 'public.contacts'::regclass;
  if v_policies <> 3 then
    raise exception 'expected 3 remaining contacts policies, found %', v_policies;
  end if;
end $$;

commit;
