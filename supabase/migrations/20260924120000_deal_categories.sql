alter table "public"."deals" add column "categories" text[] not null default '{}'::text[];

-- Move each deal's single category into the new array
update "public"."deals" set categories = array[category] where category is not null and category <> '';

alter table "public"."deals" drop column "category";
