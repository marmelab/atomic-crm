# Practice-CRM

**Owner:** Eswatini Consulting  
**Purpose:** A CRM and tax-compliance manager for a consulting practice based in the Kingdom of Eswatini. Manage clients, track ERS (Eswatini Revenue Service) filing deadlines on a per-company Compliance Calendar, and log billable time with draft invoice generation.

Built on [Atomic CRM](https://github.com/marmelab/atomic-crm) — React + shadcn-admin-kit + Supabase.

## Features

- 📇 **Manage Clients**: Contacts and companies with Eswatini-specific fields (TIN, registration number, entity type, VAT/PAYE/SDL flags).
- 📅 **Compliance Calendar**: Auto-generate annual ERS filing schedules per company. Calendar, Kanban, and list views.
- ⏱️ **Time Billing**: Log billable hours, generate draft invoices with 15% VAT in SZL (Emalangeni).
- 📝 **Notes & Tasks**: Capture important details and set follow-up reminders.
- 📊 **Deals Pipeline**: Track engagements and proposals in a Kanban board.
- 🔄 **Import & Export**: Transfer contacts in and out via CSV.

## Eswatini Domain Notes

- **Currency:** SZL (Emalangeni) — displayed as `E5,000.00`. Pegged 1:1 with ZAR.
- **Tax year:** 1 July – 30 June (default). Companies may have different year-ends.
- **Tax authority:** ERS (Eswatini Revenue Service) — [ers.org.sz](https://www.ers.org.sz)
- **TIN:** Single Tax Identification Number covering VAT, PAYE, Income Tax, and Provisional Tax.
- **Locale:** en-SZ, timezone Africa/Mbabane (SAST, UTC+2), date format DD/MM/YYYY.

## Installation

Requirements: **Make**, **Node 22 LTS**, **Docker** (for local Supabase).

Clone this repository:

```sh
git clone https://github.com/[username]/eswatini-crm.git
cd eswatini-crm
```

Install dependencies:

```sh
make install
```

This installs frontend dependencies and starts a local Supabase instance.

Start the app:

```sh
make start
```

Access the app at [http://localhost:5173/](http://localhost:5173/). You will be prompted to create the first user account.

Local development services:

- Supabase dashboard: [http://localhost:54323/](http://localhost:54323/)
- REST API: [http://127.0.0.1:54321](http://127.0.0.1:54321)
- Attachments storage: [http://localhost:54323/project/default/storage/buckets/attachments](http://localhost:54323/project/default/storage/buckets/attachments)
- Inbucket email testing: [http://localhost:54324/](http://localhost:54324/)

## Production Deployment

This guide deploys Practice-CRM to **Vercel** (frontend) + **Supabase** (database, auth, storage).

> **Why eu-west-1 (Ireland)?** Supabase has no Africa region as of 2025. Ireland (eu-west-1) is the closest region with reasonable latency to Eswatini and satisfies most data-residency considerations for a small practice.

---

### Step 1 — Create a production Supabase project

1. Go to [supabase.com](https://supabase.com) → **New project**.
2. Choose your organisation.
3. **Project name:** `practice-crm` (or similar).
4. **Database password:** generate a strong one and save it in a password manager.
5. **Region:** `West EU (Ireland)` — `eu-west-1`.
6. Click **Create new project** and wait for provisioning (~2 minutes).

---

### Step 2 — Apply database migrations

Once the project is provisioned, run the following from your project directory (you need [Supabase CLI](https://supabase.com/docs/guides/cli) installed):

```sh
# Link your local project to the remote Supabase project
npx supabase link --project-ref YOUR_PROJECT_REF

# Push all migrations (creates tables, views, triggers, and Eswatini fields)
npx supabase db push
```

`YOUR_PROJECT_REF` is the string in your Supabase project URL: `https://YOUR_PROJECT_REF.supabase.co`.

---

### Step 3 — Set environment variables

Create a `.env.production` file in the project root (this file is git-ignored):

```
VITE_SUPABASE_URL=https://YOUR_PROJECT_REF.supabase.co
VITE_SUPABASE_ANON_KEY=your-anon-key-from-supabase-dashboard
```

Find these values in your Supabase dashboard → **Project Settings → API**.

- `VITE_SUPABASE_URL` — the project URL shown under "Project URL".
- `VITE_SUPABASE_ANON_KEY` — the `anon` / `public` key shown under "Project API keys".

> **Do not commit `.env.production`** — it contains your API key.

---

### Step 4 — Create the first user

In Supabase dashboard → **Authentication → Users → Add user** → create your admin email + password.

This becomes the login for the app. You can add up to 2 more users the same way (1–3 user practice tool).

---

### Step 5 — Deploy to Vercel

1. Push your code to GitHub (create a private repo if you haven't already).
2. Go to [vercel.com](https://vercel.com) → **Add New Project** → import your GitHub repo.
3. **Framework preset:** Vite (auto-detected).
4. Under **Environment Variables**, add:
   - `VITE_SUPABASE_URL` = `https://YOUR_PROJECT_REF.supabase.co`
   - `VITE_SUPABASE_ANON_KEY` = your anon key
5. Click **Deploy**.

Vercel will build and publish the app. You get a URL like `https://practice-crm-xxxx.vercel.app`.

---

### Step 6 — Configure Supabase Auth redirect URL

In Supabase dashboard → **Authentication → URL Configuration**:

- **Site URL:** `https://your-vercel-url.vercel.app`
- **Redirect URLs:** add `https://your-vercel-url.vercel.app/**`

This allows Supabase Auth magic-link and password-reset emails to redirect to your live app.

---

### Step 7 — Verify the deployment

Open your Vercel URL → log in → create one company → generate a compliance schedule → confirm filings appear. That's the smoke test.

---

## Documentation

The user and developer documentation for this project is available [in the `doc/` directory](./doc/). You can also read it online at [https://marmelab.com/atomic-crm/doc/](https://marmelab.com/atomic-crm/doc/).

## Testing Changes

This project contains unit tests and e2e. 
Run unit test with the following command:

```sh
make test
```

Run e2e test with:

```sh
make test-e2e
```

Note: the `make test-e2e` will run the the e2e test in ui mode against a vite server with hot reload for ease of development. On the CI the e2e test will be run against the built app. If you need to run the test against the built file instead. You can run:

```sh
make start-e2e-ci # To launch the CI e2e environment (serving the built app)
# followed by
npx playwright test --ui
```

You can add your own unit tests powered by Jest anywhere in the `src` directory. The test files should be named `*.test.tsx` or `*.test.ts`.
And you can also add your own e2e test. The e2e test files should be placed inside the `./e2e` folder

## Getting Updates

Atomic CRM components are published as a Shadcn Registry file. This means you can update your installation by calling the following command:

```sh
npx shadcn add https://marmelab.com/atomic-crm/r/atomic-crm.json -o
```

## Registry

The Registry file is kept au to date when files are added or removed:

- The `registry.json` file is automatically generated by the `scripts/generate-registry.mjs` script as a pre-commit hook.
- The `http://marmelab.com/atomic-crm/r/atomic-crm.json` file is automatically published by the CI/CD pipeline

> [!WARNING]  
> If the `registry.json` misses some changes you made, you MUST update the `scripts/generate-registry.mjs` to include those changes.

## License

This project is licensed under the MIT License, courtesy of [Marmelab](https://marmelab.com). See the [LICENSE.md](./LICENSE.md) file for details.
