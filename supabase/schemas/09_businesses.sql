--
-- Business ownership of data rows
-- Every data table carries business_id, defaulting to the current business of
-- the requesting user, so clients never send it. Declared last so the column
-- order matches the migrations (business_id was added after the fts columns).
-- Tables and helpers: 01_tables.sql, 02_functions.sql; policies: 05_policies.sql.
--

alter table public.companies add column business_id uuid not null default public.current_business_id();
alter table public.contacts add column business_id uuid not null default public.current_business_id();
alter table public.contact_notes add column business_id uuid not null default public.current_business_id();
alter table public.deals add column business_id uuid not null default public.current_business_id();
alter table public.deal_notes add column business_id uuid not null default public.current_business_id();
alter table public.tags add column business_id uuid not null default public.current_business_id();
alter table public.tasks add column business_id uuid not null default public.current_business_id();

alter table public.configuration alter column id set default public.current_business_id();

alter table public.companies
    add constraint companies_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.contacts
    add constraint contacts_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.contact_notes
    add constraint contact_notes_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.deals
    add constraint deals_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.deal_notes
    add constraint deal_notes_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.tags
    add constraint tags_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;
alter table public.tasks
    add constraint tasks_business_id_fkey foreign key (business_id) references public.businesses(id) on delete cascade;

-- A row may only reference rows of its own business: references to companies,
-- contacts and deals go through (id, business_id). Array references
-- (contacts.tags, deals.contact_ids) are checked by a trigger (04_triggers.sql).
alter table public.companies add constraint companies_id_business_id_key unique (id, business_id);
alter table public.contacts add constraint contacts_id_business_id_key unique (id, business_id);
alter table public.deals add constraint deals_id_business_id_key unique (id, business_id);

alter table public.contacts
    add constraint contacts_company_id_fkey foreign key (company_id, business_id) references public.companies(id, business_id) on update cascade on delete cascade;
alter table public.contact_notes
    add constraint "contactNotes_contact_id_fkey" foreign key (contact_id, business_id) references public.contacts(id, business_id) on update cascade on delete cascade;
alter table public.deals
    add constraint deals_company_id_fkey foreign key (company_id, business_id) references public.companies(id, business_id) on update cascade on delete cascade;
alter table public.deal_notes
    add constraint "dealNotes_deal_id_fkey" foreign key (deal_id, business_id) references public.deals(id, business_id) on update cascade on delete cascade;
alter table public.tasks
    add constraint tasks_contact_id_fkey foreign key (contact_id, business_id) references public.contacts(id, business_id) on update cascade on delete cascade;

create index companies_business_id_idx on public.companies using btree (business_id);
create index contacts_business_id_idx on public.contacts using btree (business_id);
create index contact_notes_business_id_idx on public.contact_notes using btree (business_id);
create index deals_business_id_idx on public.deals using btree (business_id);
create index deal_notes_business_id_idx on public.deal_notes using btree (business_id);
create index tags_business_id_idx on public.tags using btree (business_id);
create index tasks_business_id_idx on public.tasks using btree (business_id);

-- A row may only reference rows of its own business (array references)
create or replace trigger "05_check_same_business_references"
    before insert or update of tags, business_id on public.contacts
    for each row execute function public.check_same_business_references();

create or replace trigger check_same_business_references
    before insert or update of contact_ids, business_id on public.deals
    for each row execute function public.check_same_business_references();

-- Business data: members of the current business read; everyone but
-- accountants (read-only role) writes. business_id defaults to the current
-- business, so clients never send it.
create policy "Business read" on public.companies for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.companies for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.companies for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.companies for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.contacts for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.contacts for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.contacts for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.contacts for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.contact_notes for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.contact_notes for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.contact_notes for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.contact_notes for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.deals for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.deals for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.deals for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.deals for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.deal_notes for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.deal_notes for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.deal_notes for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.deal_notes for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.tags for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.tags for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.tags for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.tags for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));

create policy "Business read" on public.tasks for select to authenticated using (business_id = (select public.current_business_id()));
create policy "Business insert" on public.tasks for insert to authenticated with check (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
create policy "Business update" on public.tasks for update to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business())) with check (business_id = (select public.current_business_id()));
create policy "Business delete" on public.tasks for delete to authenticated using (business_id = (select public.current_business_id()) and (select public.can_write_current_business()));
