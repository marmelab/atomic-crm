-- Out-of-range closing dates (typos such as 5-digit years, BC dates, infinity) break the deal page.
-- Clear the existing ones first: the constraint would not apply otherwise,
-- and any later update of such a row (e.g. moving the deal on the Kanban board) would be rejected.
update "public"."deals"
set "expected_closing_date" = null
where not ("expected_closing_date" between '1900-01-01' and '2900-12-31');

alter table "public"."deals" add constraint "deals_expected_closing_date_range" check ((("expected_closing_date" >= '1900-01-01'::date) and ("expected_closing_date" <= '2900-12-31'::date)));
