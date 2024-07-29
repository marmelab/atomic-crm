alter table "public"."dealNotes" drop column "status";

alter table "public"."deals" drop column "start_at";

alter table "public"."deals" rename column "type" to "category";

alter table "public"."deals" add column "nb_notes" integer;
