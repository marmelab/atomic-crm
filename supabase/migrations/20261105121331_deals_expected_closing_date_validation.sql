alter table "public"."deals" alter column "expected_closing_date" set not null;

alter table "public"."deals" add constraint "deals_expected_closing_date_year" check ((extract(year from "expected_closing_date") >= 1900) and (extract(year from "expected_closing_date") <= 2099));
