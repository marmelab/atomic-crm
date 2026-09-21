-- ===========================================================================
-- The six Living Example Start Weeks Leif has stated
-- ===========================================================================
--
-- MAIN-only, and listed as such in replay-manifest.json: it names six real
-- clients and six real dates. The structural half — the
-- start_date_source column, its constraints, and the shape-based
-- classification of every other row — lives in 20260921130000 and replays
-- into an empty database on its own.
--
-- Leif has confirmed every future Living Example start:
--
--   Ava Frotton      first week of October 2026   -> 2026-10-05
--   Denise Cormier   first week of October 2026   -> 2026-10-05
--   Emma Wijns       week of 8 November 2026      -> 2026-11-08
--   Linda Turner     week of 8 November 2026      -> 2026-11-08
--   Daniel Alexander week of 8 November 2026      -> 2026-11-08
--   Heidi Elias      week of 8 November 2026      -> 2026-11-08
--
-- Five of these already held the right DATE for the wrong REASON: they
-- were back-filled from each client's first booked session by migration
-- 20260918180000. The value happened to agree; the basis did not exist.
-- Marking them 'owner' is what makes them usable as capacity commitments.
--
-- One is a genuine correction. Denise Cormier's Enrollment said 30
-- September because that is when she first booked. Her Start Week is the
-- first week of October, and the difference is not cosmetic: under the old
-- date the practice went to thirteen on 30 September, and the openings
-- ledger reported September as over-committed. It was not. A session
-- booked before somebody's start week is a person getting organised, not
-- the programme beginning.
--
-- Daniel Alexander has never booked anything at all, so his date had no
-- traceable basis in this CRM and the classification rule filed it as
-- 'unknown'. It was right about the evidence and it is now moot: Leif has
-- stated the week.
--
-- Every row is matched by name AND by the value being replaced, so a row
-- that has since moved on is left alone rather than overwritten.

do $$
declare
  v_expected constant int := 6;
  v_confirmed int := 0;
  v_n int;
  v_case record;
begin
  for v_case in
    select * from (values
      ('Ava',    'Frotton',   date '2026-10-05', date '2026-10-05'),
      ('Denise', 'Cormier',   date '2026-09-30', date '2026-10-05'),
      ('Emma',   'Wijns',     date '2026-11-08', date '2026-11-08'),
      ('Linda',  'Turner',    date '2026-11-08', date '2026-11-08'),
      ('Daniel', 'Alexander', date '2026-11-08', date '2026-11-08'),
      ('Heidi',  'Elias',     date '2026-11-08', date '2026-11-08')
    ) as t(first_name, last_name, was, becomes)
  loop
    update enrollments e
       set start_date = v_case.becomes,
           start_date_source = 'owner',
           updated_at = now()
      from deals d
      join contacts c on c.id = d.contact_id
     where e.opportunity_id = d.id
       and d.offer_id = 1
       and c.first_name = v_case.first_name
       and c.last_name = v_case.last_name
       -- Either the date Leif is replacing, or the one he is confirming:
       -- both make this safe to re-run and refuse to touch a row that has
       -- moved somewhere else entirely.
       and e.start_date in (v_case.was, v_case.becomes);

    get diagnostics v_n = row_count;
    if v_n > 1 then
      raise exception '% % has % Living Example Enrollments, expected one',
        v_case.first_name, v_case.last_name, v_n;
    end if;
    v_confirmed := v_confirmed + v_n;
  end loop;

  raise notice 'owner-stated Start Weeks: % of % rows now canonical',
    v_confirmed, v_expected;
end $$;

-- Verification: what the capacity ledger is about to be built on.
do $$
declare
  v_n int;
begin
  -- All six are owner-stated.
  select count(*) into v_n
    from enrollments e
    join deals d on d.id = e.opportunity_id
    join contacts c on c.id = d.contact_id
   where d.offer_id = 1
     and e.start_date_source = 'owner'
     and (c.first_name, c.last_name) in (
       ('Ava','Frotton'), ('Denise','Cormier'), ('Emma','Wijns'),
       ('Linda','Turner'), ('Daniel','Alexander'), ('Heidi','Elias'));
  if v_n <> 6 then
    raise exception 'expected 6 owner-stated Start Weeks, found %', v_n;
  end if;

  -- Denise really moved, and nobody is left on 30 September.
  select count(*) into v_n
    from enrollments e
    join deals d on d.id = e.opportunity_id
   where d.offer_id = 1 and e.start_date = date '2026-09-30';
  if v_n <> 0 then
    raise exception '% Living Example Enrollment(s) still start on 2026-09-30', v_n;
  end if;

  -- And nothing was invented: a start date still implies a source.
  select count(*) into v_n from enrollments
   where (start_date is null) <> (start_date_source is null);
  if v_n <> 0 then
    raise exception '% Enrollment(s) have a start date with no source', v_n;
  end if;
end $$;

-- ---------------------------------------------------------------------------
-- The twelve current clients' Start Weeks, also stated by Leif
-- ---------------------------------------------------------------------------
--
-- Same authority, same day. These twelve were the ones still marked
-- 'session_derived' — every projected finish and therefore every future
-- opening rested on a date the CRM had inferred from a booking.
--
-- Three of them were wrong, which is the point: had the openings ledger
-- shipped on the imported values it would have been confidently incorrect
-- about when slots free.
--
--   Jules Litman-Cleper   24 June  -> 20 May       (five weeks earlier)
--   Gigi George           19 July  -> 20 July
--   Mackenzie Stabler     29 July  ->  3 August    (Leif calls her Kenzie;
--                                                   the Contact record is
--                                                   not renamed here)
--
-- The other nine already held the right date for the wrong reason, and are
-- promoted to owner-stated so the forecast stops describing itself as
-- provisional.
--
-- NOTE for whoever reads this next: Jules's Start Week plus four months is
-- 20 September 2026, which has already passed, and Leif still considers him
-- a current client. A projected end is a projection. Nothing in this
-- repository may retire a container or release its slot on arithmetic
-- alone — see capacity/occupancyLedger.ts, which keeps an overdue
-- projection occupied and surfaces it for Leif instead.

do $$
declare
  v_n int;
  v_total int := 0;
  v_case record;
begin
  for v_case in
    select * from (values
      ('Jules',     'Litman-Cleper', date '2026-05-20'),
      ('Adriano',   'Castro',        date '2026-06-14'),
      ('Jess',      'Beauchamp',     date '2026-06-14'),
      ('Emily',     'Loeb',          date '2026-07-20'),
      ('Gigi',      'George',        date '2026-07-20'),
      ('Mia',       'Cosme',         date '2026-07-20'),
      ('Morgan',    'Schenkeveld',   date '2026-07-20'),
      ('Mackenzie', 'Stabler',       date '2026-08-03'),
      ('Erik',      'Amundson',      date '2026-08-17'),
      ('Sarah',     'Monast',        date '2026-08-17'),
      ('Pete',      'Bassett',       date '2026-09-10'),
      ('Gina',      'McNamara',      date '2026-09-16')
    ) as t(first_name, last_name, start_week)
  loop
    update enrollments e
       set start_date = v_case.start_week,
           start_date_source = 'owner',
           updated_at = now()
      from deals d
      join contacts c on c.id = d.contact_id
     where e.opportunity_id = d.id
       and d.offer_id = 1
       and c.first_name = v_case.first_name
       and c.last_name = v_case.last_name
       -- Only a container that is still running. A completed or withdrawn
       -- Enrollment is history and is not re-dated here.
       and e.status in ('onboarding', 'active', 'offboarding');

    get diagnostics v_n = row_count;
    if v_n > 1 then
      raise exception '% % has % live Living Example Enrollments, expected one',
        v_case.first_name, v_case.last_name, v_n;
    end if;
    v_total := v_total + v_n;
  end loop;

  raise notice 'owner-stated current Start Weeks: % rows', v_total;
end $$;

do $$
declare
  v_n int;
begin
  -- Every live Living Example Start Week is now owner-stated. Nothing in
  -- the capacity forecast rests on a booking any more.
  select count(*) into v_n
    from enrollments e
    join deals d on d.id = e.opportunity_id
   where d.offer_id = 1
     and e.status in ('onboarding', 'active', 'offboarding')
     and e.start_date_source is distinct from 'owner';
  if v_n <> 0 then
    raise exception '% live Living Example Enrollment(s) still lack an owner-stated Start Week', v_n;
  end if;

  -- The three corrections actually landed.
  select count(*) into v_n
    from enrollments e
    join deals d on d.id = e.opportunity_id
    join contacts c on c.id = d.contact_id
   where d.offer_id = 1
     and ((c.last_name = 'Litman-Cleper' and e.start_date = date '2026-05-20')
       or (c.last_name = 'George'        and e.start_date = date '2026-07-20')
       or (c.last_name = 'Stabler'       and e.start_date = date '2026-08-03'));
  if v_n <> 3 then
    raise exception 'expected 3 corrected Start Weeks, found %', v_n;
  end if;

  -- Jules is still a current client, and stays one. His projected end has
  -- passed; that is a question for Leif, never a reason to close him.
  select count(*) into v_n
    from enrollments e
    join deals d on d.id = e.opportunity_id
    join contacts c on c.id = d.contact_id
   where c.last_name = 'Litman-Cleper'
     and e.status in ('onboarding', 'active', 'offboarding')
     and e.end_date is null;
  if v_n <> 1 then
    raise exception 'Jules Litman-Cleper should still be one live Enrollment with no end date, found %', v_n;
  end if;
end $$;
