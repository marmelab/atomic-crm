alter table public.deals
    add column if not exists temperature_level smallint;

do $$
begin
    if not exists (
        select 1
        from pg_constraint
        where conname = 'deals_temperature_level_check'
    ) then
        alter table public.deals
            add constraint deals_temperature_level_check
            check (temperature_level is null or temperature_level between 1 and 3);
    end if;
end $$;
