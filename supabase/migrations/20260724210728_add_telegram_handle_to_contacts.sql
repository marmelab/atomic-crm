drop view if exists "public"."contacts_summary";

alter table "public"."contacts" add column "telegram_handle" text;

create or replace view "public"."contacts_summary" as  SELECT co.id,
    co.first_name,
    co.last_name,
    co.gender,
    co.title,
    co.background,
    co.avatar,
    co.first_seen,
    co.last_seen,
    co.has_newsletter,
    co.status,
    co.tags,
    co.company_id,
    co.sales_id,
    co.linkedin_url,
    co.email_jsonb,
    co.phone_jsonb,
    co.telegram_handle,
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath))::text AS phone_fts,
    c.name AS company_name,
    count(DISTINCT t.id) FILTER (WHERE (t.done_date IS NULL)) AS nb_tasks
   FROM ((public.contacts co
     LEFT JOIN public.tasks t ON ((co.id = t.contact_id)))
     LEFT JOIN public.companies c ON ((co.company_id = c.id)))
  GROUP BY co.id, c.name;

grant all on table "public"."contacts_summary" to "anon";

grant all on table "public"."contacts_summary" to "authenticated";

grant all on table "public"."contacts_summary" to "service_role";

grant delete on table "public"."companies" to "anon";

grant insert on table "public"."companies" to "anon";

grant select on table "public"."companies" to "anon";

grant update on table "public"."companies" to "anon";

grant delete on table "public"."configuration" to "anon";

grant insert on table "public"."configuration" to "anon";

grant select on table "public"."configuration" to "anon";

grant update on table "public"."configuration" to "anon";

grant delete on table "public"."configuration" to "authenticated";

grant delete on table "public"."configuration" to "service_role";

grant delete on table "public"."contact_notes" to "anon";

grant insert on table "public"."contact_notes" to "anon";

grant select on table "public"."contact_notes" to "anon";

grant update on table "public"."contact_notes" to "anon";

grant delete on table "public"."contacts" to "anon";

grant insert on table "public"."contacts" to "anon";

grant select on table "public"."contacts" to "anon";

grant update on table "public"."contacts" to "anon";

grant delete on table "public"."deal_notes" to "anon";

grant insert on table "public"."deal_notes" to "anon";

grant select on table "public"."deal_notes" to "anon";

grant update on table "public"."deal_notes" to "anon";

grant delete on table "public"."deals" to "anon";

grant insert on table "public"."deals" to "anon";

grant select on table "public"."deals" to "anon";

grant update on table "public"."deals" to "anon";

grant delete on table "public"."favicons_excluded_domains" to "anon";

grant insert on table "public"."favicons_excluded_domains" to "anon";

grant select on table "public"."favicons_excluded_domains" to "anon";

grant update on table "public"."favicons_excluded_domains" to "anon";

grant delete on table "public"."sales" to "anon";

grant insert on table "public"."sales" to "anon";

grant select on table "public"."sales" to "anon";

grant update on table "public"."sales" to "anon";

grant delete on table "public"."tags" to "anon";

grant insert on table "public"."tags" to "anon";

grant select on table "public"."tags" to "anon";

grant update on table "public"."tags" to "anon";

grant delete on table "public"."tasks" to "anon";

grant insert on table "public"."tasks" to "anon";

grant select on table "public"."tasks" to "anon";

grant update on table "public"."tasks" to "anon";


