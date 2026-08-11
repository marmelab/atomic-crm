alter table "public"."sales" add column "secondary_emails" jsonb not null default '[]'::jsonb;
