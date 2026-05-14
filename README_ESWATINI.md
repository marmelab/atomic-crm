# Practice-CRM

**CRM and tax-compliance manager for Eswatini Consulting**
Kingdom of Eswatini · Built on a fork of [Atomic CRM](https://github.com/marmelab/atomic-crm)

---

## What this is

A small, self-hosted CRM built specifically for an Eswatini-based consulting practice. It tracks the people and companies the firm works with, the engagements in flight, the recurring **Eswatini Revenue Service (ERS)** filings due each month, and the chargeable hours behind every client invoice.

It is **not** an accounting system, an ERS e-Tax client, or a multi-tenant SaaS. It is the operating dashboard for one practice.

---

## Features

### Core CRM (inherited from Atomic CRM)
- Contacts and Companies with notes, tasks, and full activity history
- Deals on a Kanban pipeline with custom stages
- Tasks with reminders and due dates
- Email-to-CRM capture by CC'ing the system address
- Custom fields, custom theme, swappable components
- Login with email, Google, Azure, Keycloak, or Auth0

### Eswatini extensions (this fork)
- **Eswatini Company fields**: TIN (Tax Identification Number), Certificate of Incorporation no, Entity Type (Pty Ltd / Public Co / Sole Prop / Partnership / Trust / NGO — no Close Corporation, that doesn't exist here), VAT-registered flag, VAT filing frequency, PAYE-registered flag, SDL-registered flag, Provisional Tax flag, Employee count (for Workmen's Comp), Financial Year-End, Trading License number and expiry, Tax Clearance Certificate expiry
- **Eswatini Contact fields**: TIN, National ID number (or passport for foreign nationals), Role at company
- **Compliance Calendar** module — recurring ERS filings per client (VAT Return, PAYE Return, Provisional Tax, ITF Company, ITF Individual, Workman's Compensation, Trading License Renewal, Tax Clearance Renewal, AFS, Independent Review). Auto-generated annual schedule based on each company's year-end and registrations. Calendar / Kanban / List views. Dashboard widget showing filings due this week. *(Graded Tax / Poll Tax was repealed effective 15 September 2023 and is not auto-generated; see `docs/COMPLIANCE_FILING_REFERENCE.md` for full filing rules.)*
- **Time Billing** module — log hours per client (billable / non-billable), service line tagging, draft invoice generation with 15% VAT, **SZL formatting** (E prefix) throughout
- All currency in **SZL** (Emalangeni — E prefix), all dates in **DD/MM/YYYY**, timezone **Africa/Mbabane** (SAST, UTC+2)

> **Note on currency.** Eswatini's Lilangeni (SZL) is pegged 1:1 with the South African Rand under the Common Monetary Area, and ZAR is also legal tender in Eswatini. The app stores SZL but the same numeric value is interchangeable with ZAR if a client invoices in either.

---

## Tech stack

| Layer | Choice |
|---|---|
| Frontend | React 18, Vite, TypeScript |
| UI | shadcn/ui + Tailwind CSS |
| Admin framework | react-admin |
| Backend | Supabase (Postgres + Auth + Storage) |
| Hosting | Vercel (frontend) + Supabase (backend) |
| Region | eu-west-1 (Ireland) — closest production region to Eswatini (Supabase has no Africa region) |

No Docker. No self-hosted servers. Free tiers cover a 1–3 person practice with room to spare.

---

## Local development

### Prerequisites
- Node.js 20+ (`node --version`)
- npm or pnpm
- A Supabase account (free, [sign up here](https://supabase.com))

### First-time setup
```bash
# 1. Clone your fork
git clone https://github.com/YOUR_USERNAME/practice-crm.git
cd practice-crm

# 2. Install dependencies
npm install

# 3. Copy the env template
cp .env.development.example .env.development

# 4. Start the local Supabase stack (uses Docker under the hood)
npx supabase start

# 5. Apply migrations to local Supabase
npx supabase db reset

# 6. Run the dev server
npm run dev
```

The app boots at **http://localhost:5173**. Local Supabase Studio is at **http://localhost:54323**.

### Daily development
```bash
npm run dev          # Start the frontend
npx supabase start   # Start local Supabase (if not already running)
```

### Useful scripts
| Command | What it does |
|---|---|
| `npm run dev` | Vite dev server with hot reload |
| `npm run build` | Production build into `dist/` |
| `npm run lint` | Run ESLint |
| `npm test` | Run unit tests |
| `npx supabase migration new <name>` | Create a new migration file |
| `npx supabase db reset` | Wipe local DB and re-apply all migrations |

---

## Production deployment

The full step-by-step guide is in [`docs/SUPABASE_PRODUCTION_SETUP.md`](./docs/SUPABASE_PRODUCTION_SETUP.md).

Short version:
1. Create a production Supabase project in the **eu-west-1 (Ireland)** region
2. Apply migrations via the Supabase SQL Editor or CLI
3. Configure Vercel with the production Supabase URL and anon key as env vars
4. Deploy

Free tier limits (Supabase + Vercel) cover a 1–3 user practice with comfortable headroom.

---

## Project structure

```
practice-crm/
├── src/
│   ├── components/
│   │   └── atomic-crm/       # Atomic CRM core — extend, do not replace
│   │       ├── companies/    # Eswatini fields added here
│   │       ├── contacts/     # Eswatini fields added here
│   │       ├── deals/
│   │       ├── notes/
│   │       └── providers/    # Supabase data provider — keep as-is
│   ├── modules/
│   │   ├── compliance/       # Compliance Calendar (this fork)
│   │   └── billing/          # Time Billing (this fork)
│   ├── lib/
│   │   ├── format.ts         # SZL currency (E prefix) + DD/MM/YYYY date helpers
│   │   └── eswatini-validators.ts  # TIN, registration no, ID no validators
│   └── App.tsx
├── supabase/
│   └── migrations/           # All schema changes — every change is a new file
├── public/
│   └── favicon.svg           # Company lettermark
└── docs/
    ├── SUPABASE_PRODUCTION_SETUP.md
    └── COMPLIANCE_FILING_REFERENCE.md
```

---

## Custom data model

### `companies` (extended)
Beyond Atomic CRM defaults, the following columns are added:
| Column | Type | Notes |
|---|---|---|
| `tin` | text | Tax Identification Number issued by ERS — single number for VAT, PAYE, Income Tax, Provisional Tax |
| `registration_number` | text | Certificate of Incorporation number from Registrar of Companies |
| `entity_type` | text enum | PTY_LTD, PUBLIC_CO, SOLE_PROP, PARTNERSHIP, TRUST, NGO, OTHER (no CC — Close Corporation does not exist in Eswatini) |
| `vat_registered` | boolean | True if registered for VAT (registration threshold E500,000 turnover) |
| `vat_filing_frequency` | text enum | MONTHLY, BIMONTHLY, QUARTERLY (only relevant if vat_registered) |
| `paye_registered` | boolean | True if employer registered for PAYE |
| `sdl_registered` | boolean | Skills Development Levy — applies if PAYE-registered |
| `provisional_tax_registered` | boolean | True for most companies |
| `employees_count` | integer | Current headcount — used for Workmen's Compensation premium and payroll reporting. (Originally for Graded Tax, which was repealed effective 15 September 2023.) |
| `financial_year_end_month` | smallint | 1–12, defaults to 6 (June — Eswatini standard) |
| `trading_license_number` | text | Annual trading license issued by municipality |
| `trading_license_expiry` | date | Triggers renewal reminder |
| `tax_clearance_certificate_expiry` | date | TCC must be current for govt contracts |

### `contacts` (extended)
| Column | Type | Notes |
|---|---|---|
| `tin` | text | Tax Identification Number — same single-TIN system applies to individuals |
| `national_id_number` | text | Swazi National Identity Card number, or passport for foreign nationals |
| `role_at_company` | text | Free text — Director, Public Officer, Bookkeeper, FD, etc. |

### `compliance_filings` (new)
One row per filing per period per company. Auto-generated by the "Generate annual schedule" action on a Company page.

| Column | Type |
|---|---|
| `id` | uuid PK |
| `company_id` | uuid FK |
| `filing_type` | text enum (see [COMPLIANCE_FILING_REFERENCE.md](./docs/COMPLIANCE_FILING_REFERENCE.md)) |
| `period_covered` | text |
| `due_date` | date |
| `submitted_date` | date nullable |
| `status` | text enum: UPCOMING, IN_PROGRESS, SUBMITTED, OVERDUE |
| `assigned_to` | uuid FK |
| `notes` | text |

### `time_entries` and `invoices` (new)
See `src/modules/billing/types.ts` for the full schema. Amounts stored in SZL (numeric type, no currency code column — the app is single-currency).

---

## Filing types reference (Eswatini Revenue Service)

| Code | Filing | Frequency | Default due date |
|---|---|---|---|
| `VAT_RETURN` | VAT Return | Monthly / Bi-monthly / Quarterly (per ERS assignment) | 30th of month after period end |
| `PAYE_RETURN` | Monthly PAYE/SDL | Monthly | 7th of following month |
| `PROV_TAX_FIRST` | Provisional Tax instalment 1 | Annual | 31 December |
| `PROV_TAX_SECOND` | Provisional Tax instalment 2 | Annual | 30 June (FY end) |
| `INCOME_TAX_COMPANY` | ITF Company Return | Annual | 120 days after 30 June ≈ 31 October |
| `INCOME_TAX_INDIVIDUAL` | ITF Individual Return | Annual | 30 November |
| ~~`GRADED_TAX`~~ | ~~Graded Tax (Poll Tax)~~ | — | **REPEALED 15 Sep 2023** — not auto-generated. Enum value retained for historical backfill. |
| `WORKMENS_COMP` | Workman's Compensation | Annual | Industry-rated — confirm with client |
| `TRADING_LICENSE_RENEWAL` | Trading License renewal | Annual | Per municipality (often 31 March) |
| `TAX_CLEARANCE_RENEWAL` | Tax Clearance Certificate | As needed | When required for contracts/tenders |
| `AFS` | Annual Financial Statements | Annual | Internal milestone (anchor to FY end) |
| `INDEPENDENT_REVIEW` | Independent Review | Annual | Internal milestone |

> **Source.** Tax year (1 July – 30 June), 120-day filing window after FY end, PAYE 7th-of-month, and Provisional Tax dates verified against [ers.org.sz](https://www.ers.org.sz) and PwC's Eswatini tax summaries (2025/2026). VAT due date and Workman's Compensation deadlines vary in practice — verify with the client's actual ERS assignment letter before relying on the defaults.

---

## Roadmap (deliberately deferred)

These are NOT in v1. They will be considered in later phases:
- ERS e-Tax / TaxEase / ORMB integration (the API surface is restrictive and certification is heavy)
- Document storage and version control per client
- E-signature for engagement letters
- Mobile / PWA shell
- Multi-tenant version for licensing to other practices
- Bank feed integration for time-stamping work-against-payment cycles
- Multi-currency support (deferred — most clients invoice in SZL or ZAR which are pegged 1:1)

---

## Credits

This project is a fork of [marmelab/atomic-crm](https://github.com/marmelab/atomic-crm), released under the MIT licence. Atomic CRM is built and maintained by [Marmelab](https://marmelab.com). All extensions in this fork are © Eswatini Consulting.

The original Atomic CRM telemetry endpoint has been left in place as part of the upstream MIT licence terms — it sends only the deployment domain, no personal or client data. See `src/components/atomic-crm/root/CRM.tsx` for the call site if you wish to disable it locally.

## Licence

MIT — same as the upstream project. See [LICENSE](./LICENSE).
