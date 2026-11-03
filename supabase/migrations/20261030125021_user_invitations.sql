create table "public"."user_invitations" (
    "user_id" uuid not null
);

alter table "public"."user_invitations" enable row level security;

CREATE UNIQUE INDEX user_invitations_pkey ON public.user_invitations USING btree (user_id);

alter table "public"."user_invitations" add constraint "user_invitations_pkey" PRIMARY KEY using index "user_invitations_pkey";

revoke all on table "public"."user_invitations" from "anon", "authenticated";

grant all on table "public"."user_invitations" to "service_role";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.handle_new_user()
 RETURNS trigger
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
declare
  sales_count int;
begin
  select count(id) into sales_count
  from public.sales;

  delete from public.user_invitations where user_id = new.id;
  if sales_count > 0 and not found and not new.is_sso_user then
    raise exception 'Sign up is not allowed';
  end if;

  insert into public.sales (first_name, last_name, email, user_id, administrator)
  values (
    coalesce(new.raw_user_meta_data ->> 'first_name', new.raw_user_meta_data -> 'custom_claims' ->> 'first_name', 'Pending'),
    coalesce(new.raw_user_meta_data ->> 'last_name', new.raw_user_meta_data -> 'custom_claims' ->> 'last_name', 'Pending'),
    new.email,
    new.id,
    case when sales_count > 0 then FALSE else TRUE end
  );
  return new;
end;
$function$
;
