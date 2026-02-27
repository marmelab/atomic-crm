-- Migrating from timestamp with timezone to date only for expected_closing_date as we don't need the precision
-- And by only handling the date part in the client it caused conversion issues for users in different timezones
ALTER table "public"."deals" ALTER COLUMN "expected_closing_date" TYPE date USING "expected_closing_date"::date;
