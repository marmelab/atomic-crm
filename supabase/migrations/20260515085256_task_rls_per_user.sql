drop policy "Enable insert for authenticated users only" on "public"."tasks";

drop policy "Enable read access for authenticated users" on "public"."tasks";

drop policy "Task Delete Policy" on "public"."tasks";

drop policy "Task Update Policy" on "public"."tasks";


  create policy "Task Insert Policy"
  on "public"."tasks"
  as permissive
  for insert
  to authenticated
with check ((public.is_admin() OR (sales_id IN ( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = auth.uid())))));



  create policy "Task Select Policy"
  on "public"."tasks"
  as permissive
  for select
  to authenticated
using ((public.is_admin() OR (sales_id IN ( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = auth.uid())))));



  create policy "Task Delete Policy"
  on "public"."tasks"
  as permissive
  for delete
  to authenticated
using ((public.is_admin() OR (sales_id IN ( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = auth.uid())))));



  create policy "Task Update Policy"
  on "public"."tasks"
  as permissive
  for update
  to authenticated
using ((public.is_admin() OR (sales_id IN ( SELECT sales.id
   FROM public.sales
  WHERE (sales.user_id = auth.uid())))));



