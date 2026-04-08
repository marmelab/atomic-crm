drop policy if exists "authenticated_select_integration_log"
on public.integration_log;

create policy "admin_select_integration_log"
on public.integration_log
for select
to authenticated
using (
  exists (
    select 1
    from public.sales
    where public.sales.user_id = auth.uid()
      and public.sales.administrator = true
  )
);
