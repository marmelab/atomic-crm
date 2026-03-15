-- Add a `type` column to companies to distinguish investors, partners, clients, etc.
alter table "public"."companies" add column "type" text;

-- Grant access
grant select, insert, update on "public"."companies" to "authenticated";
grant select, insert, update on "public"."companies" to "service_role";
