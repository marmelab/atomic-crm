alter table "public"."deals" add column "categories" text[];

update "public"."deals" set "categories" = array["category"] where "category" is not null;

alter table "public"."deals" drop column "category";
