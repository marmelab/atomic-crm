alter table "public"."companies" rename column "stateAbbr" TO "state_abbr";
alter view "public"."companies_summary" rename column "stateAbbr" TO "state_abbr";
alter table "public"."contactNotes" rename to "contact_notes";
alter table "public"."dealNotes" rename to "deal_notes";
