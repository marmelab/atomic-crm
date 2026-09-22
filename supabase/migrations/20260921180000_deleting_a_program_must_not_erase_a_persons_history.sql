-- Deleting a Program or a round must not take people's history with it.
--
-- The application already refuses this, names what is linked, and offers
-- Archive instead. That guard is necessary and it is not sufficient: it is
-- one code path in front of a destructive operation the database was
-- willing to perform. A delete issued from anywhere else — a SQL console,
-- a script, a future screen that forgets to ask — met no resistance at
-- all.
--
-- What the database actually said, before this migration:
--
--   deals.cohort_id                       no action  -> refused
--   applications.intended_cohort_id       no action  -> refused
--   waitlist_invitation_batches.cohort_id no action  -> refused
--   acuity_appointment_type_map.cohort_id no action  -> refused
--   waitlist_entries.cohort_id            CASCADE    -> OBEYED
--
-- So a round whose only link was its waiting list deleted cleanly and
-- erased every membership on it. The January 2027 round has fifty-one.
-- e2e/programDeleteSafety.spec.ts proved it by doing it.
--
-- The same audit on the Program itself found five more of the same class,
-- every one of them reachable when no Opportunity exists (an Opportunity
-- would already have refused the delete through deals.offer_id):
--
--   waitlist_entries.offer_id          the same people, waiting at the
--                                      Programme level rather than for one
--                                      round
--   cohorts.offer_id                   every round of the programme, and
--                                      with it every waiting list under
--                                      them
--   client_sessions.offer_id           attendance. enrollment_id is
--                                      nullable, so a session booked by
--                                      somebody who never enrolled is a
--                                      real fact about a real person with
--                                      nothing else holding it up
--   scholarship_slots.offer_id         allocated places, holder_deal_id
--                                      nullable
--   scholarship_slot_events.offer_id   the append-only record of who was
--                                      given one and when
--
-- All six become NO ACTION, which is how every protective foreign key in
-- this schema is already written (deals.cohort_id and the rest carry no
-- delete clause at all). ON UPDATE CASCADE is kept exactly as it was — an
-- id that moves should still be followed; it is only the DESTRUCTION that
-- was wrong.
--
-- Left as CASCADE on purpose, because these belong to the Programme rather
-- than to a person, and none of them is a fact about anybody:
--
--   offer_payment_options              the Programme's own price list
--   onboarding_requirement_templates   configuration
--   offboarding_requirement_templates  configuration
--   expected_session_windows           a mirror of Leif's Google Calendar,
--                                      rebuilt by Sync Calendar. Its
--                                      downstream chain
--                                      (enrollment_expected_sessions ->
--                                      client_session_cadence_issues ->
--                                      ..._events) does carry owner
--                                      classifications, but every row in it
--                                      hangs off an Enrollment, an
--                                      Enrollment needs an Opportunity, and
--                                      deals.offer_id already refuses to
--                                      let that Programme be deleted. The
--                                      chain is empty precisely when the
--                                      cascade could fire.

-- ---------------------------------------------------------------------------
-- A waiting list is not a property of the round it is waiting for
-- ---------------------------------------------------------------------------
alter table "public"."waitlist_entries"
    drop constraint "waitlist_entries_cohort_id_fkey";
alter table "public"."waitlist_entries"
    add constraint "waitlist_entries_cohort_id_fkey"
    foreign key ("cohort_id") references "public"."cohorts"("id")
    on update cascade;

alter table "public"."waitlist_entries"
    drop constraint "waitlist_entries_offer_id_fkey";
alter table "public"."waitlist_entries"
    add constraint "waitlist_entries_offer_id_fkey"
    foreign key ("offer_id") references "public"."offers"("id")
    on update cascade;

-- ---------------------------------------------------------------------------
-- A round is history, and the way into every waiting list beneath it
-- ---------------------------------------------------------------------------
alter table "public"."cohorts"
    drop constraint "cohorts_offer_id_fkey";
alter table "public"."cohorts"
    add constraint "cohorts_offer_id_fkey"
    foreign key ("offer_id") references "public"."offers"("id")
    on update cascade;

-- ---------------------------------------------------------------------------
-- Attendance, and the places Leif gave away
-- ---------------------------------------------------------------------------
alter table "public"."client_sessions"
    drop constraint "client_sessions_offer_id_fkey";
alter table "public"."client_sessions"
    add constraint "client_sessions_offer_id_fkey"
    foreign key ("offer_id") references "public"."offers"("id")
    on update cascade;

alter table "public"."scholarship_slots"
    drop constraint "scholarship_slots_offer_id_fkey";
alter table "public"."scholarship_slots"
    add constraint "scholarship_slots_offer_id_fkey"
    foreign key ("offer_id") references "public"."offers"("id")
    on update cascade;

alter table "public"."scholarship_slot_events"
    drop constraint "scholarship_slot_events_offer_id_fkey";
alter table "public"."scholarship_slot_events"
    add constraint "scholarship_slot_events_offer_id_fkey"
    foreign key ("offer_id") references "public"."offers"("id")
    on update cascade;

-- ---------------------------------------------------------------------------
-- And make it unrepeatable
-- ---------------------------------------------------------------------------
-- Asserted as an exact SET, not as "none of the six". A new table hung off
-- offers or cohorts with a convenient ON DELETE CASCADE is the same defect
-- arriving by a different door, and it would otherwise be found by somebody
-- losing rows rather than by this chain refusing to replay.
do $$
declare
    offending text;
    allowed text[] := array[
        'offer_payment_options',
        'onboarding_requirement_templates',
        'offboarding_requirement_templates',
        'expected_session_windows'
    ];
begin
    select string_agg(c.conrelid::regclass::text || '.' || c.conname, ', ' order by c.conname)
      into offending
      from pg_constraint c
     where c.contype = 'f'
       and c.confdeltype = 'c'
       and c.confrelid in ('public.cohorts'::regclass, 'public.offers'::regclass)
       and c.conrelid::regclass::text <> all (allowed);

    if offending is not null then
        raise exception
            'deleting a Program or round would cascade into: %. Either it holds no fact about a person (add it to the allowed list here, with the reason) or it must be NO ACTION.',
            offending;
    end if;

    -- The other half of the same question: the protections must actually
    -- be in place, not merely un-cascaded. A constraint someone dropped
    -- and forgot to re-add would pass the check above by not existing.
    if (select count(*) from pg_constraint c
         where c.contype = 'f'
           and c.conname in (
               'waitlist_entries_cohort_id_fkey',
               'waitlist_entries_offer_id_fkey',
               'cohorts_offer_id_fkey',
               'client_sessions_offer_id_fkey',
               'scholarship_slots_offer_id_fkey',
               'scholarship_slot_events_offer_id_fkey'
           )
           and c.confdeltype = 'a') <> 6 then
        raise exception
            'expected all six Program/round foreign keys to exist and refuse deletion';
    end if;
end $$;
