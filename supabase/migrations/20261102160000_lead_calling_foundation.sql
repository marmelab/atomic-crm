drop policy "Company Delete Policy" on "public"."companies";

drop policy "Enable insert for authenticated users only" on "public"."companies";

drop policy "Enable read access for authenticated users" on "public"."companies";

drop policy "Enable update for authenticated users only" on "public"."companies";

drop policy "Enable insert for authenticated users only" on "public"."company_sectors";

drop policy "Enable read access for authenticated users" on "public"."company_sectors";

drop policy "Contact Notes Delete Policy" on "public"."contact_notes";

drop policy "Contact Notes Update policy" on "public"."contact_notes";

drop policy "Enable insert for authenticated users only" on "public"."contact_notes";

drop policy "Enable read access for authenticated users" on "public"."contact_notes";

drop policy "Contact Delete Policy" on "public"."contacts";

drop policy "Enable insert for authenticated users only" on "public"."contacts";

drop policy "Enable read access for authenticated users" on "public"."contacts";

drop policy "Enable update for authenticated users only" on "public"."contacts";

drop policy "Deal Notes Delete Policy" on "public"."deal_notes";

drop policy "Deal Notes Update Policy" on "public"."deal_notes";

drop policy "Enable insert for authenticated users only" on "public"."deal_notes";

drop policy "Enable read access for authenticated users" on "public"."deal_notes";

drop policy "Deals Delete Policy" on "public"."deals";

drop policy "Enable insert for authenticated users only" on "public"."deals";

drop policy "Enable read access for authenticated users" on "public"."deals";

drop policy "Enable update for authenticated users only" on "public"."deals";

drop policy "Enable read access for authenticated users" on "public"."sales";

drop policy "Enable delete for authenticated users only" on "public"."tags";

drop policy "Enable insert for authenticated users only" on "public"."tags";

drop policy "Enable read access for authenticated users" on "public"."tags";

drop policy "Enable update for authenticated users only" on "public"."tags";

drop policy "Enable insert for authenticated users only" on "public"."tasks";

drop policy "Enable read access for authenticated users" on "public"."tasks";

drop policy "Task Delete Policy" on "public"."tasks";

drop policy "Task Update Policy" on "public"."tasks";

revoke delete on table "public"."companies" from "anon";

revoke insert on table "public"."companies" from "anon";

revoke references on table "public"."companies" from "anon";

revoke select on table "public"."companies" from "anon";

revoke trigger on table "public"."companies" from "anon";

revoke truncate on table "public"."companies" from "anon";

revoke update on table "public"."companies" from "anon";

revoke delete on table "public"."company_sectors" from "anon";

revoke insert on table "public"."company_sectors" from "anon";

revoke references on table "public"."company_sectors" from "anon";

revoke select on table "public"."company_sectors" from "anon";

revoke trigger on table "public"."company_sectors" from "anon";

revoke truncate on table "public"."company_sectors" from "anon";

revoke update on table "public"."company_sectors" from "anon";

revoke delete on table "public"."configuration" from "anon";

revoke insert on table "public"."configuration" from "anon";

revoke references on table "public"."configuration" from "anon";

revoke select on table "public"."configuration" from "anon";

revoke trigger on table "public"."configuration" from "anon";

revoke truncate on table "public"."configuration" from "anon";

revoke update on table "public"."configuration" from "anon";

revoke delete on table "public"."contact_notes" from "anon";

revoke insert on table "public"."contact_notes" from "anon";

revoke references on table "public"."contact_notes" from "anon";

revoke select on table "public"."contact_notes" from "anon";

revoke trigger on table "public"."contact_notes" from "anon";

revoke truncate on table "public"."contact_notes" from "anon";

revoke update on table "public"."contact_notes" from "anon";

revoke delete on table "public"."contacts" from "anon";

revoke insert on table "public"."contacts" from "anon";

revoke references on table "public"."contacts" from "anon";

revoke select on table "public"."contacts" from "anon";

revoke trigger on table "public"."contacts" from "anon";

revoke truncate on table "public"."contacts" from "anon";

revoke update on table "public"."contacts" from "anon";

revoke delete on table "public"."deal_notes" from "anon";

revoke insert on table "public"."deal_notes" from "anon";

revoke references on table "public"."deal_notes" from "anon";

revoke select on table "public"."deal_notes" from "anon";

revoke trigger on table "public"."deal_notes" from "anon";

revoke truncate on table "public"."deal_notes" from "anon";

revoke update on table "public"."deal_notes" from "anon";

revoke delete on table "public"."deals" from "anon";

revoke insert on table "public"."deals" from "anon";

revoke references on table "public"."deals" from "anon";

revoke select on table "public"."deals" from "anon";

revoke trigger on table "public"."deals" from "anon";

revoke truncate on table "public"."deals" from "anon";

revoke update on table "public"."deals" from "anon";

revoke delete on table "public"."favicons_excluded_domains" from "anon";

revoke insert on table "public"."favicons_excluded_domains" from "anon";

revoke references on table "public"."favicons_excluded_domains" from "anon";

revoke select on table "public"."favicons_excluded_domains" from "anon";

revoke trigger on table "public"."favicons_excluded_domains" from "anon";

revoke truncate on table "public"."favicons_excluded_domains" from "anon";

revoke update on table "public"."favicons_excluded_domains" from "anon";

revoke delete on table "public"."sales" from "anon";

revoke insert on table "public"."sales" from "anon";

revoke references on table "public"."sales" from "anon";

revoke select on table "public"."sales" from "anon";

revoke trigger on table "public"."sales" from "anon";

revoke truncate on table "public"."sales" from "anon";

revoke update on table "public"."sales" from "anon";

revoke delete on table "public"."tags" from "anon";

revoke insert on table "public"."tags" from "anon";

revoke references on table "public"."tags" from "anon";

revoke select on table "public"."tags" from "anon";

revoke trigger on table "public"."tags" from "anon";

revoke truncate on table "public"."tags" from "anon";

revoke update on table "public"."tags" from "anon";

revoke delete on table "public"."tasks" from "anon";

revoke insert on table "public"."tasks" from "anon";

revoke references on table "public"."tasks" from "anon";

revoke select on table "public"."tasks" from "anon";

revoke trigger on table "public"."tasks" from "anon";

revoke truncate on table "public"."tasks" from "anon";

revoke update on table "public"."tasks" from "anon";

drop view if exists "public"."activity_log";

drop view if exists "public"."companies_summary";

drop view if exists "public"."contacts_summary";


  create table "public"."import_batches" (
    "id" bigint generated by default as identity not null,
    "created_at" timestamp with time zone not null default now(),
    "created_by" bigint,
    "file_name" text,
    "total_rows" integer not null default 0,
    "created_count" integer not null default 0,
    "duplicate_count" integer not null default 0,
    "invalid_count" integer not null default 0
      );


alter table "public"."import_batches" enable row level security;

alter table "public"."contacts" add column "assigned_at" timestamp with time zone;

alter table "public"."contacts" add column "assigned_to" bigint;

alter table "public"."contacts" add column "do_not_contact" boolean not null default false;

alter table "public"."contacts" add column "import_batch_id" bigint;

alter table "public"."contacts" add column "last_attempt_at" timestamp with time zone;

alter table "public"."contacts" add column "last_outcome" text;

alter table "public"."contacts" add column "lead_stage" text;

alter table "public"."contacts" add column "next_attempt_at" timestamp with time zone;

alter table "public"."contacts" add column "phone_e164" text;

alter table "public"."contacts" add column "recycle_reason" text;

alter table "public"."contacts" add column "recycled_at" timestamp with time zone;

alter table "public"."contacts" add column "retry_count" integer not null default 0;

alter table "public"."sales" add column "role" text not null default 'bde'::text;

CREATE INDEX contacts_assigned_to_idx ON public.contacts USING btree (assigned_to);

CREATE INDEX contacts_import_batch_id_idx ON public.contacts USING btree (import_batch_id);

CREATE INDEX contacts_lead_stage_idx ON public.contacts USING btree (lead_stage, next_attempt_at) WHERE (lead_stage IS NOT NULL);

CREATE INDEX contacts_phone_e164_idx ON public.contacts USING btree (phone_e164);

CREATE UNIQUE INDEX import_batches_pkey ON public.import_batches USING btree (id);

alter table "public"."import_batches" add constraint "import_batches_pkey" PRIMARY KEY using index "import_batches_pkey";

alter table "public"."contacts" add constraint "contacts_assigned_to_fkey" FOREIGN KEY (assigned_to) REFERENCES public.sales(id) ON DELETE SET NULL not valid;

alter table "public"."contacts" validate constraint "contacts_assigned_to_fkey";

alter table "public"."contacts" add constraint "contacts_import_batch_id_fkey" FOREIGN KEY (import_batch_id) REFERENCES public.import_batches(id) ON DELETE SET NULL not valid;

alter table "public"."contacts" validate constraint "contacts_import_batch_id_fkey";

alter table "public"."contacts" add constraint "contacts_last_outcome_check" CHECK ((last_outcome = ANY (ARRAY['interested'::text, 'callback'::text, 'no_answer'::text, 'not_interested'::text]))) not valid;

alter table "public"."contacts" validate constraint "contacts_last_outcome_check";

alter table "public"."contacts" add constraint "contacts_lead_stage_check" CHECK ((lead_stage = ANY (ARRAY['new'::text, 'queued'::text, 'in_progress'::text, 'interested'::text, 'recycled'::text, 'not_interested'::text]))) not valid;

alter table "public"."contacts" validate constraint "contacts_lead_stage_check";

alter table "public"."import_batches" add constraint "import_batches_created_by_fkey" FOREIGN KEY (created_by) REFERENCES public.sales(id) not valid;

alter table "public"."import_batches" validate constraint "import_batches_created_by_fkey";

alter table "public"."sales" add constraint "sales_role_check" CHECK ((role = ANY (ARRAY['admin'::text, 'manager'::text, 'bde'::text]))) not valid;

alter table "public"."sales" validate constraint "sales_role_check";

set check_function_bodies = off;

CREATE OR REPLACE FUNCTION public.call_engine_settings()
 RETURNS jsonb
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select jsonb_build_object(
      'dailyCallQuota', 25,
      'retryWindowWorkingDays', 3,
      'timezone', 'Asia/Kolkata',
      'workingDays', jsonb_build_array(1, 2, 3, 4, 5),
      'holidays', jsonb_build_array(),
      'recycleCooldownDays', 7,
      'assignmentTime', '08:30'
    ) || coalesce((select config -> 'callEngine' from public.configuration where id = 1), '{}'::jsonb);
$function$
;

CREATE OR REPLACE FUNCTION public.can_see_company(p_company_id bigint)
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select public.is_manager()
    or exists (
      select 1 from public.companies c
      where c.id = p_company_id and c.sales_id = public.current_sales_id()
    )
    or exists (
      select 1 from public.contacts co
      where co.company_id = p_company_id
        and (co.assigned_to = public.current_sales_id() or co.sales_id = public.current_sales_id())
    );
$function$
;

CREATE OR REPLACE FUNCTION public.crm_role()
 RETURNS text
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select role from public.sales where user_id = auth.uid() and not disabled;
$function$
;

CREATE OR REPLACE FUNCTION public.current_sales_id()
 RETURNS bigint
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select id from public.sales where user_id = auth.uid() and not disabled;
$function$
;

CREATE OR REPLACE FUNCTION public.import_leads(p_file_name text, p_rows jsonb)
 RETURNS jsonb
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
declare
    v_row jsonb;
    v_batch_id bigint;
    v_results jsonb := '[]'::jsonb;
    v_phone text;
    v_email text;
    v_company_name text;
    v_domain text;
    v_sector text;
    v_company_id bigint;
    v_contact_id bigint;
    v_seen_phones text[] := '{}';
    v_seen_emails text[] := '{}';
    v_created int := 0;
    v_duplicates int := 0;
    v_invalid int := 0;
    v_reason text;
begin
    if not public.is_manager() then
        raise exception 'Only admins and managers can import leads' using errcode = '42501';
    end if;
    if jsonb_typeof(p_rows) is distinct from 'array' then
        raise exception 'p_rows must be an array' using errcode = '22023';
    end if;

    -- Never wait on favicon / gravatar HTTP calls during a bulk import.
    perform set_config('crm.skip_enrichment', 'on', true);

    insert into public.import_batches (created_by, file_name, total_rows)
    values (public.current_sales_id(), p_file_name, jsonb_array_length(p_rows))
    returning id into v_batch_id;

    for v_row in select * from jsonb_array_elements(p_rows)
    loop
        v_phone := nullif(trim(v_row->>'phone'), '');
        v_email := nullif(lower(trim(v_row->>'email')), '');
        v_company_name := nullif(trim(v_row->>'company_name'), '');
        v_domain := nullif(lower(trim(v_row->>'domain')), '');
        v_reason := null;

        if v_phone is null and v_email is null then
            v_reason := 'missing phone and email';
        elsif v_phone is not null and v_phone !~ '^\+[1-9][0-9]{7,14}$' then
            v_reason := 'invalid phone';
        elsif v_email is not null and v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
            v_reason := 'invalid email';
        elsif v_company_name is null then
            v_reason := 'missing company name';
        elsif nullif(trim(coalesce(v_row->>'first_name', '') || coalesce(v_row->>'last_name', '')), '') is null then
            v_reason := 'missing contact name';
        end if;

        if v_reason is not null then
            v_invalid := v_invalid + 1;
            v_results := v_results || jsonb_build_object('row', v_row->'row', 'status', 'invalid', 'reason', v_reason);
            continue;
        end if;

        select co.id into v_contact_id
        from public.contacts co
        where (v_phone is not null and co.phone_e164 = v_phone)
           or (v_email is not null and co.email_jsonb @> jsonb_build_array(jsonb_build_object('email', v_email)))
        limit 1;

        if v_contact_id is not null
            or (v_phone is not null and v_phone = any (v_seen_phones))
            or (v_email is not null and v_email = any (v_seen_emails)) then
            v_duplicates := v_duplicates + 1;
            v_results := v_results || jsonb_build_object(
                'row', v_row->'row', 'status', 'duplicate',
                'reason', case when v_contact_id is null then 'duplicate in file' else 'matches an existing lead' end,
                'contact_id', v_contact_id);
            continue;
        end if;

        -- Industry: reuse a sector by label or value, or create it.
        v_sector := null;
        if nullif(trim(v_row->>'industry'), '') is not null then
            select s.value into v_sector from public.company_sectors s
            where lower(s.label) = lower(trim(v_row->>'industry')) or s.value = lower(trim(v_row->>'industry'))
            limit 1;
            if v_sector is null then
                v_sector := trim(both '-' from regexp_replace(lower(trim(v_row->>'industry')), '[^a-z0-9]+', '-', 'g'));
                insert into public.company_sectors (value, label)
                values (v_sector, trim(v_row->>'industry'))
                on conflict do nothing;
            end if;
        end if;

        -- Company: same domain or same name is the same company.
        select c.id into v_company_id from public.companies c
        where (v_domain is not null and lower(regexp_replace(c.website::text, '^(https?://)?(www\.)?([^/:]+).*$', '\3')) = v_domain)
           or lower(c.name) = lower(v_company_name)
        order by c.id
        limit 1;

        if v_company_id is null then
            insert into public.companies (name, sector, pitch_point, website, lead_date, created_at)
            values (
                v_company_name,
                v_sector,
                nullif(trim(v_row->>'pitch'), ''),
                case when v_domain is not null then 'https://' || v_domain end,
                current_date,
                now()
            )
            returning id into v_company_id;
        else
            update public.companies c set
                pitch_point = coalesce(c.pitch_point, nullif(trim(v_row->>'pitch'), '')),
                sector = coalesce(c.sector, v_sector)
            where c.id = v_company_id;
        end if;

        insert into public.contacts (
            first_name, last_name, title, company_id, email_jsonb, phone_jsonb, phone_e164,
            lead_stage, import_batch_id, first_seen, last_seen, tags
        )
        values (
            nullif(trim(v_row->>'first_name'), ''),
            nullif(trim(v_row->>'last_name'), ''),
            nullif(trim(v_row->>'title'), ''),
            v_company_id,
            case when v_email is not null then jsonb_build_array(jsonb_build_object('email', v_email, 'type', 'Work')) end,
            case when v_phone is not null then jsonb_build_array(jsonb_build_object('number', v_phone, 'type', 'Work')) end,
            v_phone,
            'new',
            v_batch_id,
            now(),
            now(),
            '{}'
        )
        returning id into v_contact_id;

        if v_phone is not null then v_seen_phones := v_seen_phones || v_phone; end if;
        if v_email is not null then v_seen_emails := v_seen_emails || v_email; end if;
        v_created := v_created + 1;
        v_results := v_results || jsonb_build_object('row', v_row->'row', 'status', 'created', 'contact_id', v_contact_id);
    end loop;

    update public.import_batches set
        created_count = v_created,
        duplicate_count = v_duplicates,
        invalid_count = v_invalid
    where id = v_batch_id;

    return jsonb_build_object(
        'batch_id', v_batch_id,
        'created', v_created,
        'duplicates', v_duplicates,
        'invalid', v_invalid,
        'rows', v_results
    );
end;
$function$
;

CREATE OR REPLACE FUNCTION public.is_manager()
 RETURNS boolean
 LANGUAGE sql
 STABLE SECURITY DEFINER
 SET search_path TO ''
AS $function$
  select coalesce(public.crm_role() in ('admin', 'manager'), false);
$function$
;

CREATE OR REPLACE FUNCTION public.sync_sales_role()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO ''
AS $function$
begin
    -- The legacy administrator flag and the role always agree.
    if tg_op = 'INSERT' then
        if new.administrator then
            new.role := 'admin';
        else
            new.administrator := new.role = 'admin';
        end if;
    elsif new.administrator is distinct from old.administrator then
        new.role := case
            when new.administrator then 'admin'
            when new.role = 'admin' then 'manager'
            else new.role
        end;
    elsif new.role is distinct from old.role then
        new.administrator := new.role = 'admin';
    end if;
    return new;
end;
$function$
;

create or replace view "public"."activity_log" as  SELECT (('company.'::text || c.id) || '.created'::text) AS id,
    'company.created'::text AS type,
    c.created_at AS date,
    c.id AS company_id,
    c.sales_id,
    ((to_jsonb(c.*) - 'fts'::text))::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.companies c
UNION ALL
 SELECT (('contact.'::text || co.id) || '.created'::text) AS id,
    'contact.created'::text AS type,
    co.first_seen AS date,
    co.company_id,
    co.sales_id,
    NULL::json AS company,
    ((to_jsonb(co.*) - 'fts'::text))::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.contacts co
UNION ALL
 SELECT (('contactNote.'::text || cn.id) || '.created'::text) AS id,
    'contactNote.created'::text AS type,
    cn.date,
    co.company_id,
    cn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    ((to_jsonb(cn.*) - 'fts'::text))::json AS contact_note,
    NULL::json AS deal_note
   FROM (public.contact_notes cn
     LEFT JOIN public.contacts co ON ((co.id = cn.contact_id)))
UNION ALL
 SELECT (('deal.'::text || d.id) || '.created'::text) AS id,
    'deal.created'::text AS type,
    d.created_at AS date,
    d.company_id,
    d.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    ((to_jsonb(d.*) - 'fts'::text))::json AS deal,
    NULL::json AS contact_note,
    NULL::json AS deal_note
   FROM public.deals d
UNION ALL
 SELECT (('dealNote.'::text || dn.id) || '.created'::text) AS id,
    'dealNote.created'::text AS type,
    dn.date,
    d.company_id,
    dn.sales_id,
    NULL::json AS company,
    NULL::json AS contact,
    NULL::json AS deal,
    NULL::json AS contact_note,
    ((to_jsonb(dn.*) - 'fts'::text))::json AS deal_note
   FROM (public.deal_notes dn
     LEFT JOIN public.deals d ON ((d.id = dn.deal_id)));


create or replace view "public"."companies_summary" as  SELECT c.id,
    c.created_at,
    c.name,
    c.sector,
    c.size,
    c.linkedin_url,
    c.website,
    c.phone_number,
    c.address,
    c.zipcode,
    c.city,
    c.state_abbr,
    c.sales_id,
    c.context_links,
    c.country,
    c.description,
    c.revenue,
    c.tax_identifier,
    c.logo,
    count(DISTINCT d.id) AS nb_deals,
    count(DISTINCT co.id) AS nb_contacts,
    c.lead_date,
    c.email,
    c.whatsapp_number,
    c.pitch_point
   FROM ((public.companies c
     LEFT JOIN public.deals d ON ((c.id = d.company_id)))
     LEFT JOIN public.contacts co ON ((c.id = co.company_id)))
  GROUP BY c.id;


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
    (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath))::text AS email_fts,
    (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath))::text AS phone_fts,
    c.name AS company_name,
    count(DISTINCT t.id) FILTER (WHERE (t.done_date IS NULL)) AS nb_tasks,
    co.whatsapp_number,
    co.is_primary,
    co.lead_stage,
    co.retry_count,
    co.last_attempt_at,
    co.next_attempt_at,
    co.last_outcome,
    co.recycled_at,
    co.recycle_reason,
    co.assigned_to,
    co.assigned_at,
    co.import_batch_id,
    co.phone_e164,
    co.do_not_contact,
    c.sector AS company_sector
   FROM ((public.contacts co
     LEFT JOIN public.tasks t ON ((co.id = t.contact_id)))
     LEFT JOIN public.companies c ON ((co.company_id = c.id)))
  GROUP BY co.id, c.name, c.sector;


CREATE OR REPLACE FUNCTION public.handle_company_saved()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$
declare company_logo text;

begin
    if new.logo is not null then
        return new;
    end if;

    -- Bulk lead import sets crm.skip_enrichment so it never waits on HTTP
    if current_setting('crm.skip_enrichment', true) = 'on' then
        return new;
    end if;

    company_logo = get_domain_favicon(new.website);
    if company_logo is null then
        return new;
    end if;

    new.logo = concat('{"src":"', company_logo, '","title":"Company favicon"}');
    return new;
end;
$function$
;

CREATE OR REPLACE FUNCTION public.handle_contact_saved()
 RETURNS trigger
 LANGUAGE plpgsql
 SET search_path TO 'public'
AS $function$declare contact_avatar text;
declare emails_length int8;
declare item jsonb;

begin
    if new.avatar is not null then
        return new;
    end if;

    -- Bulk lead import sets crm.skip_enrichment so it never waits on HTTP
    if current_setting('crm.skip_enrichment', true) = 'on' then
        return new;
    end if;

    if tg_op = 'UPDATE' and new.email_jsonb is not distinct from old.email_jsonb then
        return new;
    end if;

    select coalesce(jsonb_array_length(new.email_jsonb), 0) into emails_length;

    if emails_length = 0 then
        return new;
    end if;

    for item in select jsonb_array_elements(new.email_jsonb)
    loop
        select public.get_avatar_for_email(item->>'email') into contact_avatar;
        if (contact_avatar is not null) then
            exit;
        end if;
    end loop;

    if contact_avatar is null then
        return new;
    end if;

    new.avatar = concat('{"src":"', contact_avatar, '"}');
    return new;
end;$function$
;

CREATE OR REPLACE FUNCTION public.is_admin()
 RETURNS boolean
 LANGUAGE plpgsql
 SECURITY DEFINER
 SET search_path TO ''
AS $function$
begin
  return exists (
    select 1 from public.sales where user_id = auth.uid() and administrator = true and not disabled
  );
end;
$function$
;

grant delete on table "public"."import_batches" to "authenticated";

grant insert on table "public"."import_batches" to "authenticated";

grant references on table "public"."import_batches" to "authenticated";

grant select on table "public"."import_batches" to "authenticated";

grant trigger on table "public"."import_batches" to "authenticated";

grant truncate on table "public"."import_batches" to "authenticated";

grant update on table "public"."import_batches" to "authenticated";

grant delete on table "public"."import_batches" to "service_role";

grant insert on table "public"."import_batches" to "service_role";

grant references on table "public"."import_batches" to "service_role";

grant select on table "public"."import_batches" to "service_role";

grant trigger on table "public"."import_batches" to "service_role";

grant truncate on table "public"."import_batches" to "service_role";

grant update on table "public"."import_batches" to "service_role";


  create policy "Enable read for managers"
  on "public"."import_batches"
  as permissive
  for select
  to authenticated
using (public.is_manager());



  create policy "Company Delete Policy"
  on "public"."companies"
  as permissive
  for delete
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())));



  create policy "Enable insert for authenticated users only"
  on "public"."companies"
  as permissive
  for insert
  to authenticated
with check ((public.crm_role() IS NOT NULL));



  create policy "Enable read access for authenticated users"
  on "public"."companies"
  as permissive
  for select
  to authenticated
using (public.can_see_company(id));



  create policy "Enable update for authenticated users only"
  on "public"."companies"
  as permissive
  for update
  to authenticated
using (public.can_see_company(id))
with check ((public.crm_role() IS NOT NULL));



  create policy "Enable insert for authenticated users only"
  on "public"."company_sectors"
  as permissive
  for insert
  to authenticated
with check (public.is_manager());



  create policy "Enable read access for authenticated users"
  on "public"."company_sectors"
  as permissive
  for select
  to authenticated
using ((public.crm_role() IS NOT NULL));



  create policy "Contact Notes Delete Policy"
  on "public"."contact_notes"
  as permissive
  for delete
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())));



  create policy "Contact Notes Update policy"
  on "public"."contact_notes"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = contact_notes.contact_id))));



  create policy "Enable insert for authenticated users only"
  on "public"."contact_notes"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = contact_notes.contact_id))));



  create policy "Enable read access for authenticated users"
  on "public"."contact_notes"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = contact_notes.contact_id))));



  create policy "Contact Delete Policy"
  on "public"."contacts"
  as permissive
  for delete
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())));



  create policy "Enable insert for authenticated users only"
  on "public"."contacts"
  as permissive
  for insert
  to authenticated
with check ((public.is_manager() OR ((public.crm_role() IS NOT NULL) AND (assigned_to IS NULL))));



  create policy "Enable read access for authenticated users"
  on "public"."contacts"
  as permissive
  for select
  to authenticated
using ((public.is_manager() OR (assigned_to = public.current_sales_id()) OR (sales_id = public.current_sales_id())));



  create policy "Enable update for authenticated users only"
  on "public"."contacts"
  as permissive
  for update
  to authenticated
using ((public.is_manager() OR (assigned_to = public.current_sales_id()) OR (sales_id = public.current_sales_id())))
with check ((public.is_manager() OR (assigned_to = public.current_sales_id()) OR (sales_id = public.current_sales_id())));



  create policy "Deal Notes Delete Policy"
  on "public"."deal_notes"
  as permissive
  for delete
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())));



  create policy "Deal Notes Update Policy"
  on "public"."deal_notes"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.deals d
  WHERE (d.id = deal_notes.deal_id))));



  create policy "Enable insert for authenticated users only"
  on "public"."deal_notes"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.deals d
  WHERE (d.id = deal_notes.deal_id))));



  create policy "Enable read access for authenticated users"
  on "public"."deal_notes"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.deals d
  WHERE (d.id = deal_notes.deal_id))));



  create policy "Deals Delete Policy"
  on "public"."deals"
  as permissive
  for delete
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())));



  create policy "Enable insert for authenticated users only"
  on "public"."deals"
  as permissive
  for insert
  to authenticated
with check ((public.crm_role() IS NOT NULL));



  create policy "Enable read access for authenticated users"
  on "public"."deals"
  as permissive
  for select
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())));



  create policy "Enable update for authenticated users only"
  on "public"."deals"
  as permissive
  for update
  to authenticated
using ((public.is_manager() OR (sales_id = public.current_sales_id())))
with check ((public.crm_role() IS NOT NULL));



  create policy "Enable read access for authenticated users"
  on "public"."sales"
  as permissive
  for select
  to authenticated
using (((public.crm_role() IS NOT NULL) OR (user_id = auth.uid())));



  create policy "Enable delete for authenticated users only"
  on "public"."tags"
  as permissive
  for delete
  to authenticated
using (public.is_manager());



  create policy "Enable insert for authenticated users only"
  on "public"."tags"
  as permissive
  for insert
  to authenticated
with check ((public.crm_role() IS NOT NULL));



  create policy "Enable read access for authenticated users"
  on "public"."tags"
  as permissive
  for select
  to authenticated
using ((public.crm_role() IS NOT NULL));



  create policy "Enable update for authenticated users only"
  on "public"."tags"
  as permissive
  for update
  to authenticated
using ((public.crm_role() IS NOT NULL));



  create policy "Enable insert for authenticated users only"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
with check ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = tasks.contact_id))));



  create policy "Enable read access for authenticated users"
  on "public"."tasks"
  as permissive
  for select
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = tasks.contact_id))));



  create policy "Task Delete Policy"
  on "public"."tasks"
  as permissive
  for delete
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = tasks.contact_id))));



  create policy "Task Update Policy"
  on "public"."tasks"
  as permissive
  for update
  to authenticated
using ((EXISTS ( SELECT 1
   FROM public.contacts c
  WHERE (c.id = tasks.contact_id))));


CREATE TRIGGER sync_sales_role BEFORE INSERT OR UPDATE ON public.sales FOR EACH ROW EXECUTE FUNCTION public.sync_sales_role();

drop policy "Attachments 1mt4rzk_0" on "storage"."objects";

drop policy "Attachments 1mt4rzk_1" on "storage"."objects";

drop policy "Attachments 1mt4rzk_3" on "storage"."objects";


  create policy "Attachments 1mt4rzk_0"
  on "storage"."objects"
  as permissive
  for select
  to authenticated
using (((bucket_id = 'attachments'::text) AND (public.crm_role() IS NOT NULL)));



  create policy "Attachments 1mt4rzk_1"
  on "storage"."objects"
  as permissive
  for insert
  to authenticated
with check (((bucket_id = 'attachments'::text) AND (public.crm_role() IS NOT NULL)));



  create policy "Attachments 1mt4rzk_3"
  on "storage"."objects"
  as permissive
  for delete
  to authenticated
using (((bucket_id = 'attachments'::text) AND ((owner_id = (auth.uid())::text) OR public.is_manager())));



