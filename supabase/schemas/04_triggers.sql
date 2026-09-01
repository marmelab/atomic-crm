--
-- Triggers
-- This file declares all triggers.
--

-- Auto-populate sales_id from current auth user on insert
create or replace trigger set_company_sales_id_trigger
    before insert on public.companies
    for each row execute function public.set_sales_id_default();

create or replace trigger set_contact_sales_id_trigger
    before insert on public.contacts
    for each row execute function public.set_sales_id_default();

create or replace trigger set_contact_notes_sales_id_trigger
    before insert on public.contact_notes
    for each row execute function public.set_sales_id_default();

create or replace trigger set_deal_sales_id_trigger
    before insert on public.deals
    for each row execute function public.set_sales_id_default();

-- Validate Offer/Cohort consistency and snapshot commercial info (runs
-- before set_deal_sales_id_trigger's ordering doesn't matter here since
-- they touch disjoint columns; alphabetical trigger name keeps it first).
create or replace trigger "05_handle_deal_saved"
    before insert or update on public.deals
    for each row execute function public.handle_deal_saved();

-- Create the Opportunity's Enrollment the moment it genuinely transitions
-- into Won. Runs AFTER so the deals row (and its id) already exists for the
-- enrollments FK.
create or replace trigger on_deal_won
    after insert or update on public.deals
    for each row execute function public.handle_deal_won();

-- Convert any compatible Waitlist Entry the moment this Deal establishes
-- an active sales relationship, regardless of which flow created/advanced
-- it (Human-acceptance repair pass, §4/§5).
create or replace trigger on_deal_waitlist_sync
    after insert or update on public.deals
    for each row execute function public.handle_deal_waitlist_sync();

-- Validate Offer/Cohort consistency on a Waitlist Entry (Waitlists slice).
create or replace trigger "05_handle_waitlist_entry_saved"
    before insert or update on public.waitlist_entries
    for each row execute function public.handle_waitlist_entry_saved();

-- Keep deals.sales_call_at synchronized with sales_calls, the durable
-- source of truth (Acuity/Sales Call Lifecycle slice).
create or replace trigger on_sales_call_saved
    after insert or update or delete on public.sales_calls
    for each row execute function public.sync_deal_sales_call_at();

create or replace trigger set_deal_notes_sales_id_trigger
    before insert on public.deal_notes
    for each row execute function public.set_sales_id_default();

create or replace trigger set_task_sales_id_trigger
    before insert on public.tasks
    for each row execute function public.set_sales_id_default();

-- Auto-fetch company logo from website favicon on save
create or replace trigger company_saved
    before insert or update on public.companies
    for each row execute function public.handle_company_saved();

-- Lowercase contact emails before insert or update (must run before contact_saved)
create or replace trigger "10_lowercase_contact_emails"
    before insert or update on public.contacts
    for each row execute function public.lowercase_email_jsonb();

-- Auto-fetch contact avatar from email on save (runs after lowercase_contact_emails)
create or replace trigger "20_contact_saved"
    before insert or update on public.contacts
    for each row execute function public.handle_contact_saved();

-- Update contact.last_seen when a contact note is created
create or replace trigger on_public_contact_notes_created_or_updated
    after insert on public.contact_notes
    for each row execute function public.handle_contact_note_created_or_updated();

-- Cleanup storage attachments when contact notes are updated or deleted
create or replace trigger on_contact_notes_attachments_updated_delete_note_attachments
    after update on public.contact_notes
    for each row
    when (old.attachments is distinct from new.attachments)
    execute function public.cleanup_note_attachments();

create or replace trigger on_contact_notes_deleted_delete_note_attachments
    after delete on public.contact_notes
    for each row execute function public.cleanup_note_attachments();

-- Cleanup storage attachments when deal notes are updated or deleted
create or replace trigger on_deal_notes_attachments_updated_delete_note_attachments
    after update on public.deal_notes
    for each row
    when (old.attachments is distinct from new.attachments)
    execute function public.cleanup_note_attachments();

create or replace trigger on_deal_notes_deleted_delete_note_attachments
    after delete on public.deal_notes
    for each row execute function public.cleanup_note_attachments();

-- Auth triggers: sync auth.users to public.sales
create or replace trigger on_auth_user_created
    after insert on auth.users
    for each row execute function public.handle_new_user();

create or replace trigger on_auth_user_updated
    after update on auth.users
    for each row execute function public.handle_update_user();
