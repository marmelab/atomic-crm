--
-- Row Level Security
-- This file declares RLS policies for all tables.
--

-- Enable RLS on all tables
alter table public.companies enable row level security;
alter table public.contacts enable row level security;
alter table public.contact_notes enable row level security;
alter table public.deals enable row level security;
alter table public.deal_notes enable row level security;
alter table public.sales enable row level security;
alter table public.tags enable row level security;
alter table public.tasks enable row level security;
alter table public.configuration enable row level security;
alter table public.favicons_excluded_domains enable row level security;
alter table public.offers enable row level security;
alter table public.offer_payment_options enable row level security;
alter table public.cohorts enable row level security;
alter table public.applications enable row level security;
alter table public.enrollments enable row level security;
alter table public.waitlist_entries enable row level security;
alter table public.sales_calls enable row level security;
alter table public.sales_call_events enable row level security;
alter table public.deal_stage_events enable row level security;
alter table public.onboarding_requirement_templates enable row level security;
alter table public.enrollment_onboarding_items enable row level security;
alter table public.offboarding_requirement_templates enable row level security;
alter table public.enrollment_offboarding_items enable row level security;
alter table public.enrollment_status_events enable row level security;
alter table public.scholarship_slots enable row level security;
alter table public.scholarship_slot_events enable row level security;
alter table public.client_sessions enable row level security;
alter table public.client_session_events enable row level security;
alter table public.expected_session_windows enable row level security;
alter table public.enrollment_expected_sessions enable row level security;
alter table public.client_session_cadence_issues enable row level security;
alter table public.client_session_cadence_issue_events enable row level security;

-- Companies
create policy "Enable read access for authenticated users" on public.companies for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.companies for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.companies for update to authenticated using (true) with check (true);
create policy "Company Delete Policy" on public.companies for delete to authenticated using (true);

-- Contacts
create policy "Enable read access for authenticated users" on public.contacts for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.contacts for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.contacts for update to authenticated using (true) with check (true);
create policy "Contact Delete Policy" on public.contacts for delete to authenticated using (true);

-- Contact Notes
create policy "Enable read access for authenticated users" on public.contact_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.contact_notes for insert to authenticated with check (true);
create policy "Contact Notes Update policy" on public.contact_notes for update to authenticated using (true);
create policy "Contact Notes Delete Policy" on public.contact_notes for delete to authenticated using (true);

-- Deals
create policy "Enable read access for authenticated users" on public.deals for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deals for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.deals for update to authenticated using (true) with check (true);
create policy "Deals Delete Policy" on public.deals for delete to authenticated using (true);

-- Deal Notes
create policy "Enable read access for authenticated users" on public.deal_notes for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deal_notes for insert to authenticated with check (true);
create policy "Deal Notes Update Policy" on public.deal_notes for update to authenticated using (true);
create policy "Deal Notes Delete Policy" on public.deal_notes for delete to authenticated using (true);

-- Sales
create policy "Enable read access for authenticated users" on public.sales for select to authenticated using (true);

-- Tags
create policy "Enable read access for authenticated users" on public.tags for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.tags for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.tags for update to authenticated using (true);
create policy "Enable delete for authenticated users only" on public.tags for delete to authenticated using (true);

-- Tasks
create policy "Enable read access for authenticated users" on public.tasks for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.tasks for insert to authenticated with check (true);
create policy "Task Update Policy" on public.tasks for update to authenticated using (true);
create policy "Task Delete Policy" on public.tasks for delete to authenticated using (true);

-- Configuration (admin-only for writes)
create policy "Enable read for authenticated" on public.configuration for select to authenticated using (true);
create policy "Enable insert for admins" on public.configuration for insert to authenticated with check (public.is_admin());
create policy "Enable update for admins" on public.configuration for update to authenticated using (public.is_admin()) with check (public.is_admin());

-- Favicons excluded domains
create policy "Enable access for authenticated users only" on public.favicons_excluded_domains to authenticated using (true) with check (true);

-- Offers
create policy "Enable read access for authenticated users" on public.offers for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.offers for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.offers for update to authenticated using (true) with check (true);
create policy "Offers Delete Policy" on public.offers for delete to authenticated using (true);

-- Offer Payment Options
create policy "Enable read access for authenticated users" on public.offer_payment_options for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.offer_payment_options for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.offer_payment_options for update to authenticated using (true) with check (true);
create policy "Offer Payment Options Delete Policy" on public.offer_payment_options for delete to authenticated using (true);

-- Cohorts
create policy "Enable read access for authenticated users" on public.cohorts for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.cohorts for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.cohorts for update to authenticated using (true) with check (true);
create policy "Cohorts Delete Policy" on public.cohorts for delete to authenticated using (true);

-- Applications
create policy "Enable read access for authenticated users" on public.applications for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.applications for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.applications for update to authenticated using (true) with check (true);
create policy "Applications Delete Policy" on public.applications for delete to authenticated using (true);

-- Enrollments
create policy "Enable read access for authenticated users" on public.enrollments for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.enrollments for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.enrollments for update to authenticated using (true) with check (true);
create policy "Enrollments Delete Policy" on public.enrollments for delete to authenticated using (true);

-- Onboarding Requirement Templates
create policy "Enable read access for authenticated users" on public.onboarding_requirement_templates for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.onboarding_requirement_templates for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.onboarding_requirement_templates for update to authenticated using (true) with check (true);
create policy "Onboarding Requirement Templates Delete Policy" on public.onboarding_requirement_templates for delete to authenticated using (true);

-- Enrollment Onboarding Items
create policy "Enable read access for authenticated users" on public.enrollment_onboarding_items for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.enrollment_onboarding_items for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.enrollment_onboarding_items for update to authenticated using (true) with check (true);
create policy "Enrollment Onboarding Items Delete Policy" on public.enrollment_onboarding_items for delete to authenticated using (true);

-- Offboarding Requirement Templates
create policy "Enable read access for authenticated users" on public.offboarding_requirement_templates for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.offboarding_requirement_templates for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.offboarding_requirement_templates for update to authenticated using (true) with check (true);
create policy "Offboarding Requirement Templates Delete Policy" on public.offboarding_requirement_templates for delete to authenticated using (true);

-- Enrollment Offboarding Items
create policy "Enable read access for authenticated users" on public.enrollment_offboarding_items for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.enrollment_offboarding_items for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.enrollment_offboarding_items for update to authenticated using (true) with check (true);
create policy "Enrollment Offboarding Items Delete Policy" on public.enrollment_offboarding_items for delete to authenticated using (true);

-- Enrollment Status Events (append-only in practice — nothing in the
-- codebase updates or deletes a row — same uniform authenticated-CRUD
-- policy shape every other table in this single-admin-user CRM already
-- uses, matching deal_stage_events' own policy set exactly)
create policy "Enable read access for authenticated users" on public.enrollment_status_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.enrollment_status_events for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.enrollment_status_events for update to authenticated using (true) with check (true);
create policy "Enrollment Status Events Delete Policy" on public.enrollment_status_events for delete to authenticated using (true);

-- Scholarship Slots (never written directly by the app — only by
-- handle_deal_saved()/handle_deal_won()/handle_enrollment_scholarship_
-- slot_transition() — but authenticated needs read access for the
-- Dashboard's outstanding-reservation indicator, and the same full-CRUD
-- shape as every other trigger-managed table in this schema).
create policy "Enable read access for authenticated users" on public.scholarship_slots for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.scholarship_slots for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.scholarship_slots for update to authenticated using (true) with check (true);
create policy "Scholarship Slots Delete Policy" on public.scholarship_slots for delete to authenticated using (true);

-- Scholarship Slot Events
create policy "Enable read access for authenticated users" on public.scholarship_slot_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.scholarship_slot_events for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.scholarship_slot_events for update to authenticated using (true) with check (true);
create policy "Scholarship Slot Events Delete Policy" on public.scholarship_slot_events for delete to authenticated using (true);

-- Waitlist Entries
create policy "Enable read access for authenticated users" on public.waitlist_entries for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.waitlist_entries for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.waitlist_entries for update to authenticated using (true) with check (true);
create policy "Waitlist Entries Delete Policy" on public.waitlist_entries for delete to authenticated using (true);

-- Sales Calls
create policy "Enable read access for authenticated users" on public.sales_calls for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.sales_calls for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.sales_calls for update to authenticated using (true) with check (true);
create policy "Sales Calls Delete Policy" on public.sales_calls for delete to authenticated using (true);

-- Sales Call Events
create policy "Enable read access for authenticated users" on public.sales_call_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.sales_call_events for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.sales_call_events for update to authenticated using (true) with check (true);
create policy "Sales Call Events Delete Policy" on public.sales_call_events for delete to authenticated using (true);

-- Client Sessions
create policy "Enable read access for authenticated users" on public.client_sessions for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.client_sessions for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.client_sessions for update to authenticated using (true) with check (true);
create policy "Client Sessions Delete Policy" on public.client_sessions for delete to authenticated using (true);

-- Client Session Events
create policy "Enable read access for authenticated users" on public.client_session_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.client_session_events for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.client_session_events for update to authenticated using (true) with check (true);
create policy "Client Session Events Delete Policy" on public.client_session_events for delete to authenticated using (true);

-- Expected Session Windows
create policy "Enable read access for authenticated users" on public.expected_session_windows for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.expected_session_windows for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.expected_session_windows for update to authenticated using (true) with check (true);
create policy "Expected Session Windows Delete Policy" on public.expected_session_windows for delete to authenticated using (true);

-- Enrollment Expected Sessions
create policy "Enable read access for authenticated users" on public.enrollment_expected_sessions for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.enrollment_expected_sessions for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.enrollment_expected_sessions for update to authenticated using (true) with check (true);
create policy "Enrollment Expected Sessions Delete Policy" on public.enrollment_expected_sessions for delete to authenticated using (true);

-- Client Session Cadence Issues
create policy "Enable read access for authenticated users" on public.client_session_cadence_issues for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.client_session_cadence_issues for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.client_session_cadence_issues for update to authenticated using (true) with check (true);
create policy "Client Session Cadence Issues Delete Policy" on public.client_session_cadence_issues for delete to authenticated using (true);

-- Client Session Cadence Issue Events
create policy "Enable read access for authenticated users" on public.client_session_cadence_issue_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.client_session_cadence_issue_events for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.client_session_cadence_issue_events for update to authenticated using (true) with check (true);
create policy "Client Session Cadence Issue Events Delete Policy" on public.client_session_cadence_issue_events for delete to authenticated using (true);

-- Deal Stage Events
create policy "Enable read access for authenticated users" on public.deal_stage_events for select to authenticated using (true);
create policy "Enable insert for authenticated users only" on public.deal_stage_events for insert to authenticated with check (true);
create policy "Enable update for authenticated users only" on public.deal_stage_events for update to authenticated using (true) with check (true);
create policy "Deal Stage Events Delete Policy" on public.deal_stage_events for delete to authenticated using (true);
