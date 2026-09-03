# MEMORY

Durable Atomic CRM knowledge. One sentence per bullet, freshest first. Maintained by the `documentator` agent — see [.claude/agents/documentator.md](.claude/agents/documentator.md).

## Business Knowledge

- Core resources: contacts, companies, deals (Kanban pipeline), tasks, notes, tags, and sales (team members).
- Domain options (genders, sectors, deal stages/categories, note statuses, task types) are `<CRM>` props in `src/App.tsx`, not hardcoded.
- Sales users sync with Supabase `auth.users` via triggers; deletion is unsupported — accounts are disabled instead.
- Aggregated reads use database views (`contacts_summary`, `companies_summary`), which FakeRest emulates in the frontend.
- Two interchangeable data providers: Supabase (production) and FakeRest (in-browser demo, resets on reload).
- Filters use `ra-data-postgrest` syntax (`field_name@operator`); operators must be supported by the FakeRest `supabaseAdapter`.

## Pre-Go-Live Hardening Checklist

- **Clean-room disaster-recovery proof (mandatory before real production client data/go-live):** starting from an empty Postgres/Supabase environment, apply Atomic's complete migration chain from zero and verify the resulting tables, views, functions, triggers, indexes, grants, RLS policies, and schema assumptions match what the linked project actually has. Deferred (not waived) during the 2026-09 old-CRM-retirement slice because Docker is unavailable on the working machine and Supabase preview branching requires a Pro-plan upgrade (`402 entitlement_required`, org `ncqpxcgftercynhqbell`) that was declined for this purpose. Satisfy this once either Supabase Pro is already justified for production/backups (unlocking preview branching) or a working local Docker/Postgres environment is available.
- GYU (Growing Yourself Up) group-offer application path has no real test cohort on the linked project — never verified end-to-end against real infrastructure; only Living Example (individual offer) has been.
- Public application intake has no request-volume rate limiter yet (relies on the honeypot field, the `verify_jwt` calling-convention gate, RLS, and Supabase's platform-level protections) — acceptable at current solo-business scale, worth revisiting if abuse is ever observed.
- (Resolved 2026-09) `Dashboard.tsx`'s onboarding stepper used to also require a Contact Note (`totalContact && totalContactNotes`) before showing the real Dashboard — since public application intake never creates one, a solo owner whose first real data arrived that way (confirmed via real human Auth acceptance testing on the linked project) was permanently stuck on "Add your first note." Fixed: the stepper now gates only on having at least one Contact.
