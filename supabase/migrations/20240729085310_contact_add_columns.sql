alter table "public"."contacts" add column "linkedin_url" text;

alter table "public"."contacts" add column "nb_notes" integer;

alter table "public"."contactNotes" drop column "type";