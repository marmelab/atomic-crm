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
