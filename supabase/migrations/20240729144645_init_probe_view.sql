create view init_state as
select count(id) as is_initialized
from public.sales
limit 1;