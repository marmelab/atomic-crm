alter table "public"."companies" rename column "linkedIn" to "linkedin_url";

alter table "public"."companies" add column "context_links" json;

alter table "public"."companies" add column "country" text;

alter table "public"."companies" add column "description" text;

alter table "public"."companies" add column "nb_contacts" integer;

alter table "public"."companies" add column "nb_deals" integer;

alter table "public"."companies" add column "revenue" text;

alter table "public"."companies" add column "tax_identifier" text;

alter table "public"."companies" drop column "logo";

alter table "public"."companies" add column "logo" jsonb;
