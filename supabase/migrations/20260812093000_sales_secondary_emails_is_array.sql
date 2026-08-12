alter table "public"."sales" add constraint "sales_secondary_emails_is_array" check (jsonb_typeof(secondary_emails) = 'array') not valid;

alter table "public"."sales" validate constraint "sales_secondary_emails_is_array";
