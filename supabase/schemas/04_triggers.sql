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

-- Kanban queue-ordering slice: stamp stage_entered_at on every genuine
-- stage change, for every real pathway (Application review, sales-call
-- booking/outcomes, Kanban drag/drop, any other function that updates
-- deals.stage) — they all go through this one shared write path, so none
-- of them can bypass it. BEFORE so the value lands in the same row write.
create or replace trigger on_deal_stage_entered_at
    before insert or update on public.deals
    for each row execute function public.set_deal_stage_entered_at();

-- Create the Opportunity's Enrollment the moment it genuinely transitions
-- into Won. Runs AFTER so the deals row (and its id) already exists for the
-- enrollments FK.
create or replace trigger on_deal_won
    after insert or update on public.deals
    for each row execute function public.handle_deal_won();

-- Companion AFTER half of on_deal_stage_entered_at above: appends the
-- permanent deal_stage_events history row once the row (and its id) is
-- committed.
create or replace trigger on_deal_stage_event
    after insert or update on public.deals
    for each row execute function public.record_deal_stage_event();

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

-- Contracts + Onboarding slice: keep a Task's enrollment_id consistent
-- with its onboarding_item_id before the row is ever written (touches
-- disjoint columns from set_task_sales_id_trigger above, so ordering
-- between the two doesn't matter).
create or replace trigger set_task_enrollment_id_consistency_trigger
    before insert or update on public.tasks
    for each row execute function public.set_task_enrollment_id_consistency();

-- Contracts + Onboarding slice: Task -> checklist-item sync, the other
-- direction of the two-way sync application code implements for
-- checklist -> Task (see completeOnboardingItem.ts). Only fires on a
-- genuine done_date change, so an unrelated Task edit (retitling it,
-- changing its due date) never touches the checklist.
create or replace trigger on_task_onboarding_sync
    after update on public.tasks
    for each row
    when (old.done_date is distinct from new.done_date)
    execute function public.sync_onboarding_item_from_task();

-- Client Offboarding slice: the offboarding mirror of on_task_onboarding_sync
-- above — same guard, same reasoning, scoped to offboarding_item_id.
create or replace trigger on_task_offboarding_sync
    after update on public.tasks
    for each row
    when (old.done_date is distinct from new.done_date)
    execute function public.sync_offboarding_item_from_task();

-- Client Offboarding slice, §1: DB-level guard against skipping a
-- fulfillment-lifecycle stage entirely (e.g. onboarding -> completed,
-- onboarding -> offboarding, active -> completed) — see the function's
-- own comment for the full reasoning. Runs before the two narrower
-- requirement-completeness guards below; all three check disjoint
-- transition shapes, so their relative order never matters.
create or replace trigger enforce_enrollment_lifecycle_sequence_trigger
    before update on public.enrollments
    for each row execute function public.enforce_enrollment_lifecycle_sequence();

-- Contracts + Onboarding slice: DB-level guard against activating an
-- Enrollment with incomplete required onboarding — closes the gap left by
-- ClientEdit.tsx's plain status field (and any other direct write) that
-- doesn't go through activateEnrollment.ts's own application-level check.
create or replace trigger enforce_enrollment_activation_requirements_trigger
    before update on public.enrollments
    for each row execute function public.enforce_enrollment_activation_requirements();

-- Client Offboarding slice: seed the offboarding checklist + Tasks the
-- moment an Enrollment genuinely transitions active -> offboarding,
-- regardless of write path (Start offboarding button, ClientEdit.tsx's
-- plain status field, or any other direct write) — mirrors on_deal_won's
-- own "AFTER so the row already exists" reasoning.
create or replace trigger on_enrollment_offboarding_started
    after update on public.enrollments
    for each row execute function public.handle_enrollment_offboarding_started();

-- Client Offboarding slice: DB-level guard against completing an
-- Enrollment with incomplete required offboarding — same gap-closing
-- reasoning as enforce_enrollment_activation_requirements_trigger above.
create or replace trigger enforce_enrollment_completion_requirements_trigger
    before update on public.enrollments
    for each row execute function public.enforce_enrollment_completion_requirements();

-- Client Offboarding slice: append-only Enrollment lifecycle history —
-- every genuine status change, any write path, mirrors on_deal_stage_event
-- above.
create or replace trigger on_enrollment_status_event
    after insert or update on public.enrollments
    for each row execute function public.record_enrollment_status_event();

-- Scholarship Pricing + Capacity slice: releases a scholarship slot the
-- instant its Enrollment completes, and reclaims it (or rejects the
-- correction) on a backward correction off of completed. AFTER so it can
-- raise to abort the whole update on a genuine reclaim conflict, same
-- "trigger failure aborts the transaction" mechanism used throughout this
-- schema.
create or replace trigger on_enrollment_scholarship_slot_transition
    after update on public.enrollments
    for each row execute function public.handle_enrollment_scholarship_slot_transition();

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
