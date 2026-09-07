alter table "public"."sales" add column "secondary_emails" jsonb not null default '[]'::jsonb;

alter table "public"."sales" add constraint "sales_secondary_emails_is_array" check (jsonb_typeof(secondary_emails) = 'array');
