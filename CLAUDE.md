# Hyer CRM

## The business
- Patrick is a partner at **Hyer** (hyertalents.com), launching the **US branch**.
- Hyer = Singapore-based recruitment + Vietnam EOR (Employer of Record) + managed offshore teams + Energy/Oil & Gas retained search. Singapore EA License 22C1411.
- Goal: land the first US clients.

## US strategy
- Target: funded US tech startups (seed-Series B, 20-150 employees, raised in the last 6-18 months, actively hiring).
- Sell to Founder/CEO, CTO/VP Eng, or COO -- not HR.
- Positioning: reliability & accountability, NOT cheap labor.
- Pricing: premium-anchored (US-market rates, still ~50-65% under US cost) + "Founding Client" 15%-off-for-12-months for the first 5 logos.

## This CRM
- **What:** Atomic CRM (open-source, MIT), rebranded as "Hyer CRM."
- **Live URL:** https://cozy-semolina-708416.netlify.app
- **Hosting:** Netlify, team "Hyer", site `cozy-semolina-708416` (free tier).
- **Database:** Supabase project ref `ujfyhbdlaliwuqqwafwx`, URL https://ujfyhbdlaliwuqqwafwx.supabase.co (free tier).
- **Deploy:** pushing to `main` auto-deploys to Netlify in ~1 minute.
- **Build:** `npm run build`, publish dir `dist`.
- **Netlify env vars:** `VITE_SUPABASE_URL`, `VITE_SB_PUBLISHABLE_KEY`, `VITE_ATTACHMENTS_BUCKET=attachments`, `VITE_IS_DEMO=false`.
- **Admin login:** pat@hyertalents.com (email confirmation OFF in Supabase auth).

## CRM configuration
- **Pipeline stages:** New, Contacted, Connected, Replied - Warm, Call Booked, Proposal Sent, Won, Nurture / Later, Not a Fit.
- **Deal categories:** Dev Pod, EOR Only, EA / Ops, Customer Support, Marketing, Design, Energy / O&G Search, Other.
- **Company sectors:** SaaS, AI / ML, FinTech, Dev Tools / Infra, E-commerce / DTC, HealthTech, Marketing Agency, Energy / Oil & Gas, Other.
- **Note statuses:** Cold, Warm, Hot, Client.
- **Task types:** None, Email, LinkedIn, Call, Follow-up, Demo / Discovery, Proposal, Thank you.
- **77 Texas leads imported** (tagged Texas / Tier 1).

## Tech stack
- React 19 + TypeScript + Vite
- React Router v7, TanStack Query, React Hook Form
- shadcn-admin-kit + ra-core (react-admin headless)
- Shadcn UI + Radix UI + Tailwind CSS v4
- Supabase (PostgreSQL + REST API + Auth + Storage + Edge Functions)

## Related files (in ~/HYER/ folder, not in this repo)
- `Hyer_USA_Launch_Plan.docx` -- ICP, US price book, week-1 plan.
- `Hyer_Outreach_Assistant_SOPs.docx` -- playbook + templates for the Vietnam assistant.
- `Hyer_Pricing_Calculator.html` -- live cost-vs-Hyer savings calculator.
- `Hyer_Texas_Leads_CRM_import.csv` -- the 77 leads in CRM import format.
- `WORK/` -- earlier research (target accounts, email sequences, sales scripts).

## Working with this repo
- Make changes directly on `main` -- no branching workflow needed.
- After committing and pushing, Netlify auto-rebuilds in ~1 minute.
- For in-app changes (contacts, deals, pipeline config): use the CRM UI directly.
- For code changes (branding, new fields, features): edit this repo and push.
