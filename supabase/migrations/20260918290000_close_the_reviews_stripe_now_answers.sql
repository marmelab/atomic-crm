-- Two payment reviews are closed because the evidence now answers them.
--
-- Both were raised for the same reason: money collected exceeded the only
-- agreed total the CRM had, which was today's $4,000 LE list price stamped
-- on every imported Opportunity. Neither was a discrepancy; both were the
-- list price being wrong for an older, longer programme.
--
--   Libby Sloan-O'Brien  $750/month for twelve months, 2025-09-01 to
--                        2026-09-01 = $9,000, and exactly $9,000 was
--                        collected.
--   Mark Dickmann        a single $4,500 payment against a one-month
--                        schedule, 2026-03-12 to 2026-04-12.
--
-- Their derived totals were written from Stripe in the previous migration,
-- so the question each review asked no longer has anything to answer.
--
-- Deliberately left open, because the evidence does NOT answer them:
--
--   Kerri Fukui        two programmes, $875 x 4 and $1,000 x 6 = $9,500,
--                      against $9,620 collected. The $120 is a real
--                      question.
--   Samantha Putkunz   $4,500 collected with no schedule to say what was
--                      agreed.
--   Nicole Fielding,   legacy 1:1 coaching with no recorded price at all.
--   Sarah McNurlin
--
-- All six are finished clients. None is a current operational blocker.

begin;

do $$
declare
  v_cleared int;
begin
  update public.deals d
  set payment_review_reason = null
  from public.contacts c
  where c.id = d.contact_id
    and d.archived_at is null
    and d.payment_review_reason is not null
    and d.selected_payment_total_source = 'stripe_derived'
    -- Only where the derived total fully accounts for the money.
    and (
      select coalesce(sum(i.amount), 0)
      from public.deal_payment_schedule_items i
      where i.deal_id = d.id and i.status = 'paid'
    ) <= d.selected_payment_total + 0.01;

  get diagnostics v_cleared = row_count;
  if v_cleared <> 2 then
    raise exception 'expected to close exactly two reviews, closed %', v_cleared;
  end if;
end $$;

commit;
