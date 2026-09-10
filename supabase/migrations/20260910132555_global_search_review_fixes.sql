drop view if exists "public"."search_index";

alter table "public"."tasks" add column "created_at" timestamp with time zone not null default now();

update "public"."tasks" set "created_at" = coalesce("done_date", "due_date", "created_at");

create or replace view "public"."search_index" with (security_invoker = on) as  SELECT ('company.'::text || c.id) AS id,
    'companies'::text AS resource,
    c.id AS record_id,
    c.name AS title,
    c.sector AS subtitle,
    concat_ws(' '::text, c.name, c.sector, c.description, c.website, c.phone_number, c.zipcode, c.city, c.state_abbr) AS content,
    NULL::bigint AS contact_id,
    NULL::bigint AS deal_id,
    c.created_at AS date
   FROM public.companies c
UNION ALL
 SELECT ('contact.'::text || co.id) AS id,
    'contacts'::text AS resource,
    co.id AS record_id,
    concat_ws(' '::text, co.first_name, co.last_name) AS title,
    cc.name AS subtitle,
    concat_ws(' '::text, co.first_name, co.last_name, co.title, co.background, cc.name, (jsonb_path_query_array(co.email_jsonb, '$[*]."email"'::jsonpath))::text, (jsonb_path_query_array(co.phone_jsonb, '$[*]."number"'::jsonpath))::text) AS content,
    co.id AS contact_id,
    NULL::bigint AS deal_id,
    co.first_seen AS date
   FROM (public.contacts co
     LEFT JOIN public.companies cc ON ((cc.id = co.company_id)))
UNION ALL
 SELECT ('deal.'::text || d.id) AS id,
    'deals'::text AS resource,
    d.id AS record_id,
    d.name AS title,
    dc.name AS subtitle,
    concat_ws(' '::text, d.name, d.category, d.description, dc.name) AS content,
    NULL::bigint AS contact_id,
    d.id AS deal_id,
    d.created_at AS date
   FROM (public.deals d
     LEFT JOIN public.companies dc ON ((dc.id = d.company_id)))
  WHERE (d.archived_at IS NULL)
UNION ALL
 SELECT ('task.'::text || t.id) AS id,
    'tasks'::text AS resource,
    t.id AS record_id,
    "left"(t.text, 200) AS title,
    concat_ws(' '::text, tco.first_name, tco.last_name) AS subtitle,
    concat_ws(' '::text, t.text, t.type, tco.first_name, tco.last_name) AS content,
    t.contact_id,
    NULL::bigint AS deal_id,
    t.created_at AS date
   FROM (public.tasks t
     LEFT JOIN public.contacts tco ON ((tco.id = t.contact_id)))
  WHERE (t.done_date IS NULL)
UNION ALL
 SELECT ('contactNote.'::text || cn.id) AS id,
    'contact_notes'::text AS resource,
    cn.id AS record_id,
    "left"(cn.text, 200) AS title,
    concat_ws(' '::text, nco.first_name, nco.last_name) AS subtitle,
    concat_ws(' '::text, cn.text, nco.first_name, nco.last_name, ( SELECT string_agg((a.a ->> 'title'::text), ' '::text) AS string_agg
           FROM unnest(cn.attachments) a(a))) AS content,
    cn.contact_id,
    NULL::bigint AS deal_id,
    cn.date
   FROM (public.contact_notes cn
     LEFT JOIN public.contacts nco ON ((nco.id = cn.contact_id)))
UNION ALL
 SELECT ('dealNote.'::text || dn.id) AS id,
    'deal_notes'::text AS resource,
    dn.id AS record_id,
    "left"(dn.text, 200) AS title,
    nd.name AS subtitle,
    concat_ws(' '::text, dn.text, nd.name, ( SELECT string_agg((a.a ->> 'title'::text), ' '::text) AS string_agg
           FROM unnest(dn.attachments) a(a))) AS content,
    NULL::bigint AS contact_id,
    dn.deal_id,
    dn.date
   FROM (public.deal_notes dn
     LEFT JOIN public.deals nd ON ((nd.id = dn.deal_id)))
  WHERE (nd.archived_at IS NULL);

grant all on table public.search_index to anon;
grant all on table public.search_index to authenticated;
grant all on table public.search_index to service_role;
