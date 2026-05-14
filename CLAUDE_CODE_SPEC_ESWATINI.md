# Claude Code Spec — Eswatini CRM Build

> **Setup before pasting (one-time):**
> 1. Fork `marmelab/atomic-crm` on GitHub → clone → `cd` → `npm install`
> 2. Open the project in VS Code → open Claude Code in the project terminal → paste the prompt below

---

```
## Objective
Convert this fork of marmelab/atomic-crm into Practice-CRM — a CRM and tax-compliance manager for Eswatini Consulting, a consulting business based in the Kingdom of Eswatini. Extend the existing Atomic CRM foundation with Eswatini-specific data fields, a Compliance Calendar module (recurring ERS filings per client), and a Time Billing module. Keep Atomic CRM's existing stack (React + Vite + TypeScript + shadcn/ui + Supabase). Do NOT migrate to Firebase — that scope is forbidden in this session.

## Context (carry forward)
- This codebase is a fresh fork of marmelab/atomic-crm. Stack already in place: React + Vite + TypeScript + shadcn/ui + Supabase + react-admin.
- Decision locked from prior session: stay on Supabase. Do not propose Firebase. Do not propose alternative data layers.
- Decision locked: this is a 1–3 user practice tool, not multi-tenant SaaS. Single Supabase project. Single workspace.
- Decision locked: brand colours = professional dark navy with amber accent. Replace Practice-CRM in branding wherever Atomic CRM appears.
- Owner is a non-coder using AI tools. Prefer clarity over cleverness. Avoid clever abstractions that make the code harder to read.
- Domain: Eswatini (formerly Swaziland) — consulting practice serving Eswatini-based companies.
- Tax authority: Eswatini Revenue Service (ERS). Source of truth for filings: ers.org.sz.
- Currency: SZL (Emalangeni, abbreviated E — e.g. E5,000). SZL is pegged 1:1 with ZAR. Both are legal tender in Eswatini under the Common Monetary Area; the app stores SZL, displays "E" prefix.
- Tax year: 1 July to 30 June. This is the default financial year-end. Companies may have different year-ends but most use 30 June.
- Locale: en-SZ. Timezone: Africa/Mbabane (SAST, UTC+2). Date format: DD/MM/YYYY.
- Eswatini uses a SINGLE TIN (Tax Identification Number) issued by ERS that covers VAT, PAYE, Income Tax, and Provisional Tax. Do NOT model these as separate numbers as you would for South Africa — model ONE tin field plus boolean flags for which tax types the entity is registered for.

## Target State (binary, end-of-build)
- App boots locally via `npm run dev` and shows Practice-CRM branding (not Atomic CRM)
- Companies have Eswatini-specific fields: TIN, registration number (Certificate of Incorporation no), entity type (no Close Corporation option — does not exist in Eswatini), VAT-registered flag, VAT filing frequency, PAYE-registered flag, SDL-registered flag, financial year-end month (defaults to 6 = June), trading license number, trading license expiry
- Contacts have Eswatini-specific fields: TIN, national ID / passport number, role at company
- A new Compliance Calendar module exists with: recurring ERS filing schedule per company, calendar view, kanban view, list view, "due this week" dashboard widget
- A new Time Billing module exists with: time entry capture, billable/non-billable flag, hourly rate, draft invoice generation with 15% VAT
- All currency formatting shows E prefix (Emalangeni, SZL), all dates show DD/MM/YYYY
- All Supabase migrations are present in `supabase/migrations/` and run cleanly on a fresh database
- README updated with Eswatini-specific setup steps

## Scope
- Work only in: `src/`, `supabase/migrations/`, `public/`, `index.html`, `package.json`, `README.md`, `tailwind.config.*`, theme files
- Do NOT touch: `.env*` files, `node_modules/`, lock files, the original Atomic CRM telemetry endpoint, `.github/` workflows
- Do NOT add new top-level dependencies without explicit approval at a stop checkpoint

## Constraints
- Keep all of Atomic CRM's existing modules intact (Contacts, Companies, Deals, Notes, Tasks). EXTEND them, do not replace them.
- Use Atomic CRM's existing data provider pattern (Supabase via react-admin). Do not invent a new data layer.
- Use shadcn/ui components only. Do not introduce another component library.
- All new fields, modules, and views must follow the same code style and folder structure as existing Atomic CRM code. Read 2–3 existing files in any module before adding similar code.
- TypeScript strict mode stays on. No `any` unless unavoidable, and never silently.
- Only make changes directly requested in this brief. Do not refactor Atomic CRM internals. Do not add features beyond what is listed.

## Build in 5 phases — STOP at the end of each phase for human review

### PHASE 1 — Brand & Boot (target: app runs as Practice-CRM)
1. Replace "Atomic CRM" wordmark with "Practice-CRM" everywhere it appears in the UI (header, sidebar, login page, browser title, favicon alt text)
2. Update `package.json` name to slug version of Practice-CRM, description to "CRM and tax-compliance manager for Eswatini Consulting — Eswatini consulting practice"
3. Update theme: primary = dark navy (#0F172A range), accent = amber (#F59E0B range). Keep shadcn/ui design tokens, just change the values.
4. Update browser title, favicon SVG with company lettermark
5. Update `README.md` top section: project name, owner, one-paragraph purpose, the same setup steps as Atomic CRM but renamed
6. Confirm `npm run dev` boots cleanly and the rebrand is visible
7. ✅ STOP. Output a list of every file changed and wait for human review.

### PHASE 2 — Eswatini Data Model (target: Companies and Contacts have Eswatini fields)
1. Read the existing Atomic CRM schema for `companies` and `contacts` tables in `supabase/migrations/`
2. Create a new migration file (timestamped) that adds these columns to `companies`:
   - `tin` (text, nullable) — Tax Identification Number issued by ERS
   - `registration_number` (text, nullable) — Certificate of Incorporation number from Registrar of Companies
   - `entity_type` (text, enum: 'PTY_LTD', 'PUBLIC_CO', 'SOLE_PROP', 'PARTNERSHIP', 'TRUST', 'NGO', 'OTHER') — note: NO Close Corporation option, this entity does not exist in Eswatini
   - `vat_registered` (boolean, default false)
   - `vat_filing_frequency` (text, enum: 'MONTHLY', 'BIMONTHLY', 'QUARTERLY', nullable — only relevant if vat_registered is true)
   - `paye_registered` (boolean, default false)
   - `sdl_registered` (boolean, default false) — Skills Development Levy applies if PAYE-registered
   - `provisional_tax_registered` (boolean, default true for companies)
   - `employees_count` (integer, default 0) — current headcount, used for Workmen's Compensation premium calculation and payroll reporting. NOTE: originally intended for Graded Tax calc, but Graded Tax was repealed by the Graded Tax (Repeal) Act 2023 effective 15 September 2023 — field kept for general payroll/employer reporting purposes.
   - `financial_year_end_month` (smallint, range 1–12, default 6 — June, the Eswatini default)
   - `trading_license_number` (text, nullable)
   - `trading_license_expiry` (date, nullable)
   - `tax_clearance_certificate_expiry` (date, nullable) — TCC must be current for many activities
3. Add to `contacts` table:
   - `tin` (text, nullable) — same TIN concept applies to individuals
   - `national_id_number` (text, nullable) — Swazi National Identity Card number, or passport for foreign nationals
   - `role_at_company` (text, nullable, free text — e.g. "Director", "Bookkeeper", "Public Officer")
4. Update TypeScript types in `src/types.ts` (or wherever Atomic CRM defines them) to match
5. Add the new fields to the Company create form, Company edit form, and Company detail view. Group them under a collapsible "Eswatini Compliance" section.
6. Add the new fields to the Contact create/edit/detail in the same pattern, under an "Eswatini Identifiers" section.
7. Add lightweight format validation (visual hint only, not blocking): TIN format and national ID format follow ERS conventions — if you cannot find authoritative format documentation, leave validation as "non-empty when provided".
8. ✅ STOP. Output the migration file path, the schema diff, and a list of every UI file changed. Wait for human review.

### PHASE 3 — Compliance Calendar Module (target: recurring ERS filings per client)
1. **BEFORE writing any auto-generation logic, READ `docs/COMPLIANCE_FILING_REFERENCE.md`.** That document is the authoritative source for every filing rule, due-date computation, and auto-generation behaviour. Where this spec is less specific than the reference file, the reference file wins. If the reference file is missing, STOP and ask the human to provide it.
2. Create a new top-level entity `compliance_filings` with migration:
   - `id`, `company_id` (FK), `filing_type` (enum below), `period_covered` (text — e.g. "Mar 2026" or "FY2025/2026"), `due_date` (date), `submitted_date` (date, nullable), `status` (enum: 'UPCOMING', 'IN_PROGRESS', 'SUBMITTED', 'OVERDUE'), `assigned_to` (FK to sales/users), `notes` (text), `created_at`, `updated_at`
3. Filing type enum values (Eswatini-specific — full rules in the reference file):
   - `VAT_RETURN` — frequency varies (MONTHLY / BIMONTHLY / QUARTERLY per ERS assignment)
   - `PAYE_RETURN` — monthly, due 7th of following month
   - `PROV_TAX_FIRST` — provisional tax instalment 1, **date computed dynamically from FY-end** (not hardcoded)
   - `PROV_TAX_SECOND` — provisional tax instalment 2, **date = last day of FY** (not hardcoded)
   - `PROV_TAX_TOPUP` — individual top-up (enum value only, NOT auto-generated)
   - `INCOME_TAX_COMPANY` — annual ITF return, due ≈31 October
   - `INCOME_TAX_INDIVIDUAL` — annual individual return, due 30 November
   - `WORKMENS_COMP` — annual Workman's Compensation, due date varies by industry
   - `TRADING_LICENSE_RENEWAL` — annual, driven by license expiry date
   - `TAX_CLEARANCE_RENEWAL` — driven by TCC expiry date, no fixed deadline
   - `WHT_NON_RESIDENT` — withholding tax on payments to non-residents (enum value only, NOT auto-generated)
   - `AFS` — internal milestone
   - `INDEPENDENT_REVIEW` — internal milestone (enum value only, NOT auto-generated)
   - `GRADED_TAX` — **DEPRECATED**. Repealed by the Graded Tax (Repeal) Act 2023 effective 15 September 2023. Keep in enum for historical backfill only. NEVER auto-generate.
4. Build a "generate annual schedule" action on the Company page. Auto-generation rules (full details in the reference file):
   - If `vat_registered`: generate VAT_RETURN entries based on `vat_filing_frequency` (monthly/bi-monthly/quarterly)
   - If `paye_registered`: generate 12 monthly PAYE_RETURN entries + 1 annual WORKMENS_COMP entry
   - If `provisional_tax_registered`: generate PROV_TAX_FIRST (`due_date = FY_end_date - 6 months`) and PROV_TAX_SECOND (`due_date = FY_end_date`)
   - Always: INCOME_TAX_COMPANY (default 31 October following FY end), AFS (default 30 September following FY end — internal milestone, gives 1-month buffer before income tax return)
   - If `trading_license_expiry` is set: generate TRADING_LICENSE_RENEWAL 30 days before expiry
   - If `tax_clearance_certificate_expiry` is set: generate TAX_CLEARANCE_RENEWAL 30 days before expiry
   - **DO NOT** auto-generate GRADED_TAX (repealed September 2023), PROV_TAX_TOPUP (manual only), WHT_NON_RESIDENT (manual only), or INDEPENDENT_REVIEW (manual only)
5. Build three views in a new top-level "Compliance" section in the sidebar:
   - **Calendar view**: month grid showing all filings across all companies, colour-coded by status
   - **Kanban view**: columns Upcoming → In Progress → Submitted → Overdue
   - **List view**: sortable table with filters (company, filing type, status, date range)
6. Build a dashboard widget for the home page: "Filings due this week" — shows the next 7 days of upcoming filings sorted by due date
7. Auto-flip status to OVERDUE when due_date is past and submitted_date is null. Run this check on dashboard load (no need for cron in this phase).
8. ✅ STOP. Demonstrate one company having a full year of filings auto-generated. Wait for human review.

### PHASE 4 — Time Billing Module (target: capture chargeable hours, draft invoices)
1. Create migration for `time_entries`:
   - `id`, `company_id` (FK), `contact_id` (FK, nullable), `entry_date` (date), `hours` (numeric 5,2), `billable` (boolean default true), `hourly_rate_szl` (numeric 10,2), `service_line` (enum: 'TAX', 'AFS', 'PAYROLL', 'BOOKKEEPING', 'ADVISORY', 'COMPLIANCE', 'OTHER'), `description` (text), `linked_filing_id` (FK to compliance_filings, nullable), `invoice_id` (FK, nullable), `created_at`
2. Create migration for `invoices`:
   - `id`, `invoice_number` (text, auto-generated as INV-YYYY-NNNN), `company_id` (FK), `period_start`, `period_end`, `subtotal_szl`, `vat_szl`, `total_szl`, `status` (enum: 'DRAFT', 'SENT', 'PAID', 'CANCELLED'), `notes`, `created_at`, `updated_at`
3. Build "Log time" action: quick form (company, date, hours, billable y/n, rate, service line, description). Auto-fill rate from a per-user default (add `default_hourly_rate_szl` to the existing sales/users table).
4. Build a "Time" page in the sidebar: list of entries, filter by company / service line / billable / date range, summary chips at top (total hours this week, billable hours this week, WIP value in SZL).
5. Build "Generate Draft Invoice" action on Company page: pick a date range, system pulls all unbilled time_entries for that company in range, calculates subtotal, adds 15% VAT (only if the issuing entity is VAT-registered — expose as a toggle on the invoice form), creates an invoice in DRAFT status, marks those time_entries as linked to the invoice.
6. SZL formatting everywhere: implement a `formatSZL(amount)` helper in `src/lib/format.ts` that returns `E5,000.00` format (E prefix, comma thousands separator, 2 decimals). Do NOT use `Intl.NumberFormat('en-SZ', { style: 'currency', currency: 'SZL' })` directly — most browsers render this as "SZL 5,000.00" which is wrong; the local convention is "E5,000.00".
7. ✅ STOP. Demonstrate logging 3 time entries and generating a draft invoice for them. Wait for human review.

### PHASE 5 — Deploy (target: live URL, production database)
1. Run `npm run build` and report any errors. Fix them.
2. Run `npm run lint` (or equivalent). Fix any new errors introduced by phases 1–4. Do NOT fix pre-existing errors from upstream Atomic CRM.
3. Update README with deployment instructions: how to create a production Supabase project (region eu-west-1 Ireland — closest to Eswatini, Supabase has no Africa region), set env vars, deploy to Vercel.
4. STOP before pushing to git. STOP before deploying. Output the exact commands the human should run, and wait for them to run them.

## Stop Conditions (apply across ALL phases)
Pause and ask the human before:
- Adding any new npm dependency
- Modifying any file outside the Scope list
- Deleting any file
- Changing any Atomic CRM core behaviour or schema (you may EXTEND, not REPLACE)
- Choosing between two valid implementation paths where the choice affects architecture
- Encountering an error that cannot be resolved in 2 attempts
- Any phase end (steps marked ✅ STOP)
- Inventing an Eswatini tax rule, due date, or rate that you have not been given. If a filing rule is unclear, leave a `// TODO: confirm with ERS` comment, ask the human, and proceed with a placeholder rather than guessing.

## Forbidden Actions
- Do NOT migrate the data layer to Firebase
- Do NOT integrate with ERS e-Tax / TaxEase / ORMB — out of scope for v1
- Do NOT add any South African tax fields (VAT201, EMP201, EMP501, IRP6, ITR12, ITR14, B-BBEE) — this is an Eswatini app, not a South African app
- Do NOT add a Close Corporation entity type — Eswatini has no CC equivalent
- Do NOT build a mobile app or PWA shell
- Do NOT add authentication providers beyond what Atomic CRM ships with
- Do NOT add multi-tenancy or workspace switching
- Do NOT introduce a state management library (Redux, Zustand) — use react-admin's existing patterns
- Do NOT push to git or deploy without explicit human approval

## Progress Reporting
After each completed numbered step within a phase, output one line:
✅ [step number] [short description] — [comma-separated files affected]

At each phase boundary (✅ STOP), output:
- Files changed in this phase (full list)
- Migrations created (file paths)
- Manual verification steps the human should perform before approving the next phase
- Any decisions you made that warrant flagging
- Any Eswatini tax rules you implemented from your own assumptions (so the human can verify against ERS)

Think carefully and step-by-step before starting. Read the existing Atomic CRM code in each module before extending it. The goal is for the result to feel like a natural extension of Atomic CRM, not a bolted-on layer.

Begin Phase 1.
```

🎯 **Target:** Claude Code (Opus 4.7)
💡 **Optimised for:** Eswatini Revenue Service (ERS) compliance instead of SARS, single TIN data model instead of separate VAT/PAYE/Income Tax numbers, Eswatini entity types (no Close Corporation), Eswatini tax year (1 July – 30 June), Graded Tax / Trading License / TCC tracking unique to Eswatini, with hard guard against fabricating tax rules ("if unclear, ask, don't guess").
