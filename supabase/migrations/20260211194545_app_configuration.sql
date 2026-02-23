-- Singleton table storing the app configuration as a JSONB document.
-- Admins can customize branding, company sectors, deal stages/categories,
-- note statuses, and task types via the Settings page.
-- The app merges stored values with code defaults, so missing keys are safe.

create table "public"."configuration" (
    "id" integer not null default 1,
    "config" jsonb not null default '{}'::jsonb,
    constraint "configuration_pkey" primary key ("id"),
    constraint "configuration_singleton" check ("id" = 1)
);

alter table "public"."configuration" enable row level security;

-- Helper to check admin status in RLS policies
create or replace function public.is_admin()
returns boolean language plpgsql security definer set search_path = '' as $$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true
  );
end;
$$;

-- All authenticated users can read
create policy "Enable read for authenticated" on "public"."configuration"
  as permissive for select to authenticated using (true);

-- Only admins can insert/update
create policy "Enable insert for admins" on "public"."configuration"
  as permissive for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on "public"."configuration"
  as permissive for update to authenticated
  using (public.is_admin()) with check (public.is_admin());

-- Grants
grant select, insert, update on "public"."configuration" to "authenticated";
grant select, insert, update on "public"."configuration" to "service_role";

-- Seed empty config (code defaults apply)
insert into "public"."configuration" ("id", "config") values (1, '{}'::jsonb);

-- Migrate old label-based values to slug-based values.
--
-- Previously, companySectors, dealCategories, and taskTypes were stored as
-- plain string arrays (e.g. ["Energy", "Copywriting"]) in individual records.
-- Now they use a { value, label } format where `value` is a slug derived from
-- the label.
--
-- This converts record fields (companies.sector, deals.category, tasks.type,
-- contact_notes.status) from display labels to slugs.

CREATE OR REPLACE FUNCTION pg_temp.to_slug(label text) RETURNS text AS $$
BEGIN
  RETURN TRIM(BOTH '-' FROM REGEXP_REPLACE(LOWER(label), '[^a-z0-9]+', '-', 'g'));
END;
$$ LANGUAGE plpgsql IMMUTABLE;

UPDATE companies
SET sector = pg_temp.to_slug(sector)
WHERE sector IS NOT NULL
  AND sector != pg_temp.to_slug(sector);

UPDATE deals
SET category = pg_temp.to_slug(category)
WHERE category IS NOT NULL
  AND category != pg_temp.to_slug(category);

UPDATE tasks
SET type = pg_temp.to_slug(type)
WHERE type IS NOT NULL
  AND type != pg_temp.to_slug(type);

UPDATE contact_notes
SET status = pg_temp.to_slug(status)
WHERE status IS NOT NULL
  AND status != pg_temp.to_slug(status);
