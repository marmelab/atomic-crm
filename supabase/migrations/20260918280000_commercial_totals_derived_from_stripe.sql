-- The agreed total for ten Opportunities, derived from Stripe rather than
-- guessed from today's list price.
--
-- Every Living Example Opportunity carries $4,000 from the import, because
-- that is what LE costs now. It has not always: Mia Cosme and Emily Loeb
-- bought at $3,700, and asking Leif to remember the rest one at a time is
-- the wrong way round when Stripe already holds the answer.
--
-- The derivation is arithmetic on two facts Stripe reports directly:
--
--     subscription unit_amount  x  months in the schedule phase window
--
-- and it is only used where BOTH are readable and the result reconciles
-- exactly against money already collected, to a whole number of
-- installments. All ten below do. Morgan Schenkeveld's $925 x 4 = $3,700
-- independently confirms the historical LE price that Mia and Emily were
-- charged.
--
-- Deliberately NOT derived:
--
--   Samantha Putkunz  one cancelled $4,500 subscription and no schedule.
--                     Collected money alone cannot prove what was agreed —
--                     a plan can end with payments missed.
--   Kerri Fukui       two separate programmes ($875 x 4 and $1,000 x 6)
--                     totalling $9,500 against $9,620 collected. The $120
--                     is a real question, not a rounding.
--   Heidi Elias,      a schedule exists but its amount cannot be read: the
--   Daniel Alexander, restricted Stripe key lacks Prices Read. These become
--   Ava Frotton       derivable the moment that permission is granted.
--   Emma Wijns        no Stripe arrangement exists yet at all.
--
-- Provenance is recorded per row, so nobody later mistakes a derived total
-- for one Leif stated.

begin;

-- deals.selected_payment_total_source and its CHECK moved to
-- 20260918275000_commercial_total_source_structure.sql.
-- This migration repairs historical production data and is not replayed
-- into an empty database, so it must not be the only thing that creates
-- structure the finished CRM needs. Its assertions below are unchanged.

-- The five Leif stated directly, marked as such.
update public.deals d
set selected_payment_total_source = 'owner_confirmed'
from public.contacts c
where c.id = d.contact_id
  and d.archived_at is null
  and d.selected_payment_total is not null
  and d.selected_payment_total_source is null
  and (c.first_name, c.last_name) in (
    ('Mia', 'Cosme'), ('Emily', 'Loeb'), ('Jess', 'Beauchamp'),
    ('Jules', 'Litman-Cleper'), ('Linda', 'Turner')
  );

do $$
declare
  r record;
  v_updated int := 0;
  v_paid numeric;
begin
  for r in
    select * from (values
      -- name,              total,    installments, each,    Stripe evidence
      ('Gina',    'McNamara',        4000.00, 4,  1000.00, '$1,000/month, 2026-09-15 to 2027-01-15'),
      ('Pete',    'Bassett',         4000.00, 1,  4000.00, '$4,000/month, 2026-09-01 to 2026-10-01'),
      ('Sarah',   'Monast',          3996.00, 6,   666.00, '$666/month, 2026-08-05 to 2027-02-05'),
      ('Denise',  'Cormier',         3996.00, 6,   666.00, '$666/month, 2026-09-05 to 2027-03-05'),
      ('Libby',   'Sloan-O''Brien',  9000.00, 12,  750.00, '$750/month, 2025-09-01 to 2026-09-01'),
      ('Morgan',  'Schenkeveld',     3700.00, 4,   925.00, '$925/month, 2026-07-15 to 2026-11-15'),
      ('Adriano', 'Castro',          4000.00, 4,  1000.00, '$1,000/month, 2026-06-01 to 2026-10-01'),
      ('Erik',    'Amundson',        4000.00, 4,  1000.00, '$1,000/month, 2026-08-05 to 2026-12-05'),
      ('Mackenzie','Stabler',        4000.00, 4,  1000.00, '$1,000/month, 2026-08-01 to 2026-12-01'),
      ('Mark',    'Dickmann',        4500.00, 1,  4500.00, '$4,500/month, 2026-03-12 to 2026-04-12')
    ) as t(first_name, last_name, total, installments, each, evidence)
  loop
    -- Refuse to write a total the collected money does not fit into as a
    -- whole number of installments. If Stripe changes under us, this stops
    -- rather than recording a figure nobody can justify.
    select coalesce(sum(i.amount), 0) into v_paid
    from public.deal_payment_schedule_items i
    join public.deals d on d.id = i.deal_id
    join public.contacts c on c.id = d.contact_id
    where c.first_name = r.first_name and c.last_name = r.last_name
      and d.archived_at is null and i.status = 'paid';

    if v_paid > r.total + 0.01 then
      raise exception '% % has collected % against a derived total of %',
        r.first_name, r.last_name, v_paid, r.total;
    end if;
    if mod((v_paid * 100)::bigint, (r.each * 100)::bigint) <> 0 then
      raise exception '% % has collected %, which is not a whole number of % installments',
        r.first_name, r.last_name, v_paid, r.each;
    end if;

    update public.deals d
    set selected_payment_total = r.total,
        selected_installment_count = r.installments,
        selected_installment_amount = r.each,
        selected_payment_total_source = 'stripe_derived'
    from public.contacts c
    where c.id = d.contact_id
      and c.first_name = r.first_name and c.last_name = r.last_name
      and d.archived_at is null
      and d.selected_payment_total is null;

    get diagnostics v_updated = row_count;
    if v_updated <> 1 then
      raise exception 'expected exactly one Opportunity for % %, updated %',
        r.first_name, r.last_name, v_updated;
    end if;
  end loop;
end $$;

commit;
