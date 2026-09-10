-- Follow-up to 20260909110000: the new scholarship_slots.id identity column
-- needs its backing sequence granted, same shape as every other identity
-- column's sequence in this schema.
grant all on sequence public.scholarship_slots_id_seq to anon;
grant all on sequence public.scholarship_slots_id_seq to authenticated;
grant all on sequence public.scholarship_slots_id_seq to service_role;
