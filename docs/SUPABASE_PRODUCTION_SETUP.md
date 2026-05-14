# Supabase Production Setup — Practice-CRM

A step-by-step checklist for deploying Practice-CRM to production. Written for someone with no coding background. Follow it once, end-to-end.

**Time required:** 60–90 minutes for the first run. About 20 minutes of that is waiting.
**Cost:** E0 — Supabase free tier and Vercel free tier cover everything for a 1–3 person practice.

---

## What you are about to do

Three separate accounts, one app:

1. **Supabase** — hosts the database (Postgres) + login (Auth) + file uploads (Storage). This is where your client data lives.
2. **Vercel** — hosts the website itself. When someone opens `crm.eswatiniconsulting.co.sz`, Vercel serves the React app.
3. **GitHub** — holds your Practice-CRM source code. Vercel reads from GitHub to deploy.

You already have GitHub (your fork lives there). This guide covers Supabase + Vercel.

> 🔒 **Before you start.** Have a password manager open (1Password, Bitwarden, or even a locked Notes file). You will generate three passwords/keys in this guide. Save each one immediately. Losing them locks you out of your own database.

> 🇸🇿 **Region note for Eswatini.** Supabase has no Africa region (a Cape Town option existed in alpha years ago and was withdrawn). The closest live production region is **eu-west-1 (Ireland)** — typical ping from Mbabane is ~180–200ms. London (eu-west-2) and Frankfurt (eu-central-1) are slightly worse on average. Stick with Ireland unless your client has a specific data-residency reason to choose otherwise.

---

## Stage 1 — Create the Supabase project (10 minutes + 2 minutes wait)

### 1.1 Sign up
- Open https://supabase.com
- Click **Start your project** → sign up with GitHub (recommended — links your accounts)
- You'll land on https://supabase.com/dashboard

### 1.2 Create a new project
- Click the **New project** button (top-right green button on the dashboard)
- Fill in:
  - **Organization** — leave as default (your personal org)
  - **Name** — `practice-crm-prod` (the `-prod` suffix matters; you'll create a separate `-dev` later if you need staging)
  - **Database Password** — click **Generate a password**, then **immediately save it to your password manager** under "Practice-CRM · Supabase DB Password". You will need this for migrations and emergency access. Supabase does NOT show this again.
  - **Region** — select **West EU (Ireland)** (`eu-west-1`). This is the closest production region to Eswatini.
  - **Pricing Plan** — Free
- Click **Create new project**

Supabase shows a "Setting up project..." screen. **Wait 2–3 minutes** until it goes green. Don't navigate away.

✅ When the dashboard loads with your project's home page, this stage is done.

---

## Stage 2 — Capture the API credentials (5 minutes)

These are the values your Practice-CRM app needs to talk to Supabase.

### 2.1 Find the values
- In your project, click **Project Settings** (gear icon, bottom-left of the sidebar)
- Click **API** in the settings menu

You will see two values that matter:

| Field on the page | What it is | Where it's used |
|---|---|---|
| **Project URL** (e.g. `https://abcdefg.supabase.co`) | Public address of your database | Vercel env var: `VITE_SUPABASE_URL` |
| **Project API keys → `anon` `public`** | Public-facing key, safe to ship to browsers | Vercel env var: `VITE_SUPABASE_ANON_KEY` |

There is also a `service_role` key on the same page. **Do not put this anywhere public.** It bypasses all security rules. You will only need it for one thing later (running migrations) and it never gets shipped to the browser.

### 2.2 Save all three to your password manager
Create entries:
- `Practice-CRM · Supabase Project URL`
- `Practice-CRM · Supabase Anon Key`
- `Practice-CRM · Supabase Service Role Key` (mark as 🔒 SECRET)

✅ All three values saved. Do not paste them into the app yet.

---

## Stage 3 — Apply the database schema (15 minutes)

Your local development database has tables for companies, contacts, compliance_filings, time_entries, invoices, etc. The production database is empty. We need to copy the schema over.

There are two ways. Choose ONE.

### Option A — SQL Editor paste (easier for non-coders)

This works for the whole list of migrations.

1. In Supabase, click **SQL Editor** in the sidebar (the icon that looks like `</>`)
2. Click **+ New query**
3. On your local machine, open the project folder. Inside `supabase/migrations/`, you'll see files named like `20260101120000_create_companies.sql`, `20260102140000_extend_companies_eswatini_fields.sql`, etc.
4. Open each file **in chronological order** (the timestamp prefix is the order). Copy its full contents.
5. Paste into the Supabase SQL Editor → click **Run** (bottom-right green button)
6. Wait for "Success. No rows returned" or similar. If you see a red error, **stop and check** before running the next migration — fixing migrations out of order is painful.
7. Move to the next migration file. Repeat until done.

If you have many migrations, you can paste them all into one query separated by blank lines and run once — but only do this if you trust they all run cleanly.

### Option B — Supabase CLI (faster if you're comfortable in a terminal)

```bash
# From your Practice-CRM project folder
npx supabase login                                    # opens browser for auth
npx supabase link --project-ref <YOUR-PROJECT-REF>    # ref is in your project URL: abcdefg
npx supabase db push                                  # applies all pending migrations
```

The project ref is the bit before `.supabase.co` in your Project URL.

### 3.1 Verify it worked
- In Supabase sidebar, click **Table Editor**
- You should see all your tables: `companies`, `contacts`, `compliance_filings`, `time_entries`, `invoices`, plus the Atomic CRM core tables (`deals`, `tasks`, `notes`, etc.)
- Click into `companies` — confirm the Eswatini columns are present: `tin`, `registration_number`, `entity_type`, `vat_registered`, `vat_filing_frequency`, `paye_registered`, `sdl_registered`, `provisional_tax_registered`, `graded_tax_employees_count`, `financial_year_end_month`, `trading_license_number`, `trading_license_expiry`, `tax_clearance_certificate_expiry`
- Confirm `entity_type` enum does NOT include `CC` (no Close Corporation in Eswatini) and DOES include `PTY_LTD`, `PUBLIC_CO`, `SOLE_PROP`, `PARTNERSHIP`, `TRUST`, `NGO`, `OTHER`
- Click into `contacts` — confirm `tin`, `national_id_number`, and `role_at_company` are present

✅ Schema applied. Tables visible. Columns correct.

---

## Stage 4 — Set up authentication (10 minutes)

By default Supabase lets anyone sign up with email + password. For an internal practice tool, you don't want that.

### 4.1 Lock down sign-ups
- Sidebar → **Authentication** → **Providers**
- Find the **Email** row → click to expand
- Toggle **Confirm email** ON (forces email verification)
- Click **Save**

### 4.2 Disable open sign-ups
- Sidebar → **Authentication** → **Settings** (gear icon under Auth)
- Find **Allow new users to sign up** → toggle **OFF**
- Click **Save**

This means: only users you explicitly invite can sign in. They cannot self-register. Critical for a practice tool that holds client data.

### 4.3 Create the first user (yourself)
- Sidebar → **Authentication** → **Users**
- Click **Add user → Create new user**
- Email: your work email
- Password: generate a strong one and save to password manager as `Practice-CRM · Admin Login`
- Check **Auto Confirm User** (skips email verification for the first admin)
- Click **Create user**

### 4.4 (Optional) Enable Google sign-in
If you want one-click sign-in with your Google Workspace:
- **Authentication → Providers → Google** → enable
- Follow the Google Cloud Console setup (Supabase shows the exact steps)
- Add your firm's Google Workspace domain as the only allowed login domain

✅ Authentication locked. You have an admin user. Sign-ups are closed.

---

## Stage 5 — Confirm Row Level Security is on (5 minutes)

Atomic CRM ships with Row Level Security policies that control who can see what. They were applied as part of Stage 3 migrations. Verify:

- Sidebar → **Authentication** → **Policies**
- For each table you see (companies, contacts, deals, etc.), confirm the table has at least one policy and **RLS is enabled** (green padlock icon next to the table name)
- If any table shows **RLS disabled** (red padlock), click into it and enable RLS. Without RLS, anyone with your anon key can read everything.

✅ Every table has RLS enabled.

---

## Stage 6 — Deploy the frontend to Vercel (15 minutes)

### 6.1 Sign up for Vercel
- Open https://vercel.com
- Click **Sign Up** → continue with GitHub

### 6.2 Import the project
- On your Vercel dashboard, click **Add New... → Project**
- Find your `practice-crm` repository in the list → click **Import**
- Vercel auto-detects it as a Vite project. Don't change framework settings.

### 6.3 Add environment variables
In the import screen, expand **Environment Variables** and add:

| Name | Value | Environment |
|---|---|---|
| `VITE_SUPABASE_URL` | (from your password manager) | Production, Preview, Development |
| `VITE_SUPABASE_ANON_KEY` | (from your password manager) | Production, Preview, Development |

Do NOT add `service_role` here. It must never reach the browser.

### 6.4 Deploy
- Click **Deploy**
- Wait 2–3 minutes — Vercel builds the React app and pushes it to its global CDN
- When done, you get a URL like `practice-crm-username.vercel.app`

### 6.5 Test the live site
- Open the Vercel URL
- You should see the Practice-CRM login page (dark navy + amber, your wordmark)
- Sign in with the admin user you created in Stage 4.3
- Confirm you can see the dashboard, create a test company (with a TIN and Eswatini entity type), log a time entry — basic smoke test
- Confirm currency displays as **E** prefix (e.g. E500.00) not "SZL 500.00" or "R500.00"

✅ Site is live. You can log in. Data flows. Currency renders correctly.

---

## Stage 7 — Hook up your custom domain (optional, 10 minutes)

If you want `crm.eswatiniconsulting.co.sz` instead of the `vercel.app` URL:

### 7.1 In Vercel
- Go to your project → **Settings** → **Domains**
- Click **Add** → enter `crm.eswatiniconsulting.co.sz`
- Vercel shows you the DNS records to add

### 7.2 At your domain registrar (e.g. Domains.co.sz, Realm Digital, Cloudflare)
- Open DNS settings for `eswatiniconsulting.co.sz`
- Add a `CNAME` record:
  - **Host/Name**: `crm`
  - **Value/Target**: `cname.vercel-dns.com`
  - **TTL**: leave default (3600)
- Save

DNS takes 5–60 minutes to propagate. Vercel will auto-issue an SSL certificate (the green padlock in the browser) once it sees the record.

### 7.3 Update Supabase auth redirect URLs
- Supabase → **Authentication** → **URL Configuration**
- Add `https://crm.eswatiniconsulting.co.sz` to **Redirect URLs**
- Save

This lets login redirects work on your custom domain.

✅ Custom domain live. Padlock is green.

---

## Stage 8 — Backups (10 minutes — do this now, not later)

Supabase Free tier does daily automated backups for **7 days only**. That's not enough for a tax practice — you need to be able to roll back further than that for compliance.

### 8.1 Enable automated weekly off-site backup
The simplest path: download a manual backup once a week and store it in your Google Drive.

- Supabase → **Database** → **Backups**
- Click **Download** (or use `npx supabase db dump > practice-crm-backup-YYYY-MM-DD.sql` from the CLI)
- Save the `.sql` file to a Google Drive folder called `Practice-CRM Backups`
- Set a recurring calendar reminder for every Friday at 17:00 SAST: "Download Practice-CRM Supabase backup"

For a fully-automated path, you'd upgrade to Supabase Pro (≈ E450/month) which gives 14-day Point-in-Time Recovery. Defer until you have ≥10 active clients in the system.

### 8.2 Document the recovery path
Add to your password manager an entry called `Practice-CRM · Disaster Recovery Steps`:
- Supabase project URL
- Supabase login email
- Supabase DB password (Stage 1.2)
- Path to the latest manual backup in Google Drive
- Vercel project URL
- GitHub repo URL

If you lose your laptop tomorrow, this list is what gets the practice back online.

✅ Backups running. Recovery path documented.

---

## Stage 9 — Final checks (5 minutes)

Run through this list. Tick each item.

- [ ] Production Supabase project exists in **eu-west-1 (Ireland)**
- [ ] Database password saved in password manager
- [ ] Project URL + Anon Key + Service Role Key all saved
- [ ] All migrations applied (verify in Table Editor: companies has Eswatini columns including `tin` and `vat_registered`, no `bbbee_level` column, no separate `vat_number`/`paye_number`/`income_tax_number` columns; compliance_filings exists; time_entries and invoices exist with `_szl` suffix on amount columns)
- [ ] `entity_type` enum does NOT include CC (Close Corporation)
- [ ] Email sign-ups disabled
- [ ] Email confirmation required
- [ ] At least one admin user created
- [ ] Row Level Security enabled on every table
- [ ] Vercel project deployed and reachable
- [ ] `VITE_SUPABASE_URL` and `VITE_SUPABASE_ANON_KEY` set in Vercel — `service_role` is NOT
- [ ] Live site loads, login works, smoke-test data flows
- [ ] Currency renders as **E** prefix, not "R" or "SZL"
- [ ] Dates render as **DD/MM/YYYY**
- [ ] Timezone shows as **SAST / Africa/Mbabane** anywhere a timezone is shown
- [ ] (Optional) Custom domain `crm.eswatiniconsulting.co.sz` resolves with green padlock
- [ ] First manual backup downloaded to Google Drive
- [ ] Friday 17:00 calendar reminder set for weekly backup

---

## What to do when something breaks

| Symptom | Most likely cause | First thing to check |
|---|---|---|
| Login page loads but sign-in fails | Auth redirect URL mismatch | Supabase → Auth → URL Configuration → confirm your Vercel URL is listed |
| Page loads but no data appears | RLS too strict, or wrong env vars | Supabase → Logs → Postgres → look for permission errors |
| Build fails on Vercel | New code broke the build | Vercel → Deployments → click the failed one → read the build log |
| Seeing test data from local in production | Wrong env vars in Vercel | Vercel → Settings → Environment Variables — re-paste the production ones |
| Currency shows "SZL 5,000" not "E5,000" | Browser locale issue with `Intl.NumberFormat` | Use the custom `formatSZL()` helper in `src/lib/format.ts` instead of relying on the browser |
| Cannot log in to Supabase admin | Lost password | Use the password reset on supabase.com — it goes to the email you signed up with |

For anything more complex, paste the error into a fresh chat with Claude and include "Practice-CRM Supabase production deploy" in the first sentence.

---

## What this guide deliberately does NOT cover

- Supabase Pro features (PITR, custom SMTP, dedicated infrastructure) — defer until you have paying use
- CI/CD pipelines — Vercel's GitHub integration auto-deploys on push, that's already the simplest CI you can have
- Staging environment — add when you have a second user or you want to test breaking changes safely
- Database connection pooling — defer until performance becomes an actual problem (it won't at 1–3 users)
- ERS e-Tax / TaxEase integration — out of scope for v1

When any of those becomes relevant, open a fresh chat and ask. Don't pre-build.
