-- Capacity + Waitlist slice, §C — an Offer's length, as a number.
--
-- No Living Example Enrollment carries an end_date, so "when does this
-- client finish" has to be derived, and the only length the CRM held was
-- offers.duration: free text, written for a human to read ("4 months",
-- "8 weeks", "Varies (historical)").
--
-- Capacity arithmetic must not parse prose. An Offer edited to read
-- "Four months" — a perfectly reasonable edit to a display field — would
-- silently stop every projected end date and every future opening, with
-- nothing on screen to say so. So the number gets its own column, and the
-- prose stays prose.
--
-- Null is the honest value nearly everywhere: a group Offer runs to its
-- Cohort's dates, and the legacy 1:1 Offer genuinely varied. Null yields
-- an "unknown" projected end that is surfaced for the owner, never an
-- invented date.

alter table public.offers
  add column if not exists duration_months smallint;

alter table public.offers
  drop constraint if exists offers_duration_months_check;

alter table public.offers
  add constraint offers_duration_months_check
  check (duration_months is null or duration_months > 0);

comment on column public.offers.duration_months is
  'Programme length in whole months, for deriving projected end dates. Null when the length is not whole months (a cohort Offer, or a genuinely variable one); duration (text) remains the display value.';

-- The Living Example is a four-month programme — the owner''s own
-- statement of the fact, not an inference from the display string.
--
-- Deterministic and replay-safe: matched by shape, never by id, and with
-- no row-count assertion. Against an empty database this updates nothing,
-- which is correct — there is no Offer to describe yet.
update public.offers
   set duration_months = 4
 where type = 'individual'
   and lower(btrim(duration)) = '4 months'
   and duration_months is null;
