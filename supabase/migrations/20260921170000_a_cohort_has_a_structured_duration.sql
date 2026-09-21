-- ===========================================================================
-- A cohort's length is a number, so Start + Duration can produce an End
-- ===========================================================================
--
-- Growing Yourself Up schedules nothing like the Living Example. Everybody
-- in a round shares one start, one length and one end — the dates belong to
-- the COHORT, not to each person — so none of the twelve-session-week
-- machinery applies, and none of it is reused here.
--
-- program_start_at and program_end_at already exist and already hold the
-- right values for Fall 2026. What was missing is the length, and only as
-- prose on the parent Offer ("8 weeks"), which cannot be arithmetic:
-- somebody reasonably rewriting it as "eight weeks" would silently stop any
-- calculation that depended on it. So the number gets its own columns and
-- the prose stays prose.
--
-- The end date remains authoritative when it is set. A round that overran,
-- or took a week off in the middle, is a fact about that round — never an
-- error in the arithmetic to be corrected away.

alter table public.cohorts
  add column if not exists duration_value smallint,
  add column if not exists duration_unit text;

alter table public.cohorts
  drop constraint if exists cohorts_duration_unit_check;
alter table public.cohorts
  add constraint cohorts_duration_unit_check
  check (duration_unit is null or duration_unit in ('weeks', 'months'));

alter table public.cohorts
  drop constraint if exists cohorts_duration_value_check;
alter table public.cohorts
  add constraint cohorts_duration_value_check
  check (duration_value is null or duration_value > 0);

-- A number without a unit is not a duration, and a unit without a number
-- is not one either. One may never exist without the other.
alter table public.cohorts
  drop constraint if exists cohorts_duration_is_complete_check;
alter table public.cohorts
  add constraint cohorts_duration_is_complete_check
  check ((duration_value is null) = (duration_unit is null));

comment on column public.cohorts.duration_value is
  'How long the round runs, as a number. With duration_unit this lets Start + Duration produce an End; an explicitly recorded program_end_at always wins over the arithmetic.';

-- Growing Yourself Up runs eight weeks. Matched by shape — a group Offer
-- whose parent describes itself in weeks — rather than by cohort id, so it
-- replays into any database and describes no particular round.
update public.cohorts ch
   set duration_value = 8,
       duration_unit = 'weeks',
       updated_at = now()
  from offers o
 where o.id = ch.offer_id
   and o.type = 'group'
   and lower(btrim(o.duration)) = '8 weeks'
   and ch.duration_value is null;
