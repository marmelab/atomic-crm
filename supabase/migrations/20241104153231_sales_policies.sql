create schema if not exists "private";

set check_function_bodies = off;

drop policy "Enable insert for authenticated users only" on "public"."sales";

drop policy "Enable update for authenticated users only" on "public"."sales";
