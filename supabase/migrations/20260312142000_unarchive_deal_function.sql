-- Optimize unarchiveDeal by moving reindexing logic to the database

set check_function_bodies = off;

create or replace function public.unarchive_deal(p_deal_id bigint)
returns void
language plpgsql
security invoker
set search_path to public
as $$
declare
  v_stage text;
  v_new_index smallint;
begin
  select stage into v_stage
  from public.deals
  where id = p_deal_id;

  if v_stage is null then
    return;
  end if;

  select coalesce(max(index), 0) + 1
  into v_new_index
  from public.deals
  where stage = v_stage
    and archived_at is null
    and id <> p_deal_id;

  update public.deals
  set archived_at = null,
      index = v_new_index
  where id = p_deal_id;
end;
$$;


