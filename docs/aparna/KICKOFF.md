# KICKOFF.md — build the MVP with Claude Code online

**Role:** Environment manual + copy-paste prompts. Who does what: **you** click setup screens and merge PRs; **Claude (cloud session)** plans, writes code and tests, opens PRs; **GitHub Actions** runs everything that needs Docker (migrations, pgTAP, e2e) and deploys the database; **Vercel** shows each PR as a preview link (fake data) and serves production (real data).

---

## Part A — One-time setup (about 1 hour, mostly clicks)

### A1. GitHub
1. Open https://github.com/cuera/aparna-atomic-crm/pull/new/plan/aparna-crm-p0 → create the PR → merge it into `main`. Every session starts from `main`.
2. Settings → Secrets and variables → Actions → add repository secrets (used by the upstream `Deploy` workflow to push migrations after each merge):
   - `SUPABASE_ACCESS_TOKEN` (A2 step 4), `SUPABASE_DB_PASSWORD`, `SUPABASE_PROJECT_ID` (project ref), `SUPABASE_URL`, `SB_PUBLISHABLE_KEY`.

### A2. Supabase
1. New project `aparna-crm`, region Mumbai (`ap-south-1`). Save the database password.
2. Plan: free is fine while building with fake data. **Upgrade to Pro before the pilot** (real families' data: backups, no auto-pause).
3. Copy: Project URL, publishable key, project ref (Settings → General).
4. Account → Access Tokens → create one for GitHub Actions.
5. Authentication → URL Configuration: Site URL = your Vercel production URL (after A3); add it to Redirect URLs.

### A3. Vercel
1. Add New → Project → import `cuera/aparna-atomic-crm`. Production branch: `main`.
2. Framework preset: Vite (or Other). Output directory: `dist`.
3. Build command (Preview = demo mode with fake data, Production = real data):
   ```
   if [ "$VERCEL_ENV" = "production" ]; then npm run build; else npm run build:demo; fi
   ```
4. Environment variables — Production: `VITE_SUPABASE_URL`, `VITE_SB_PUBLISHABLE_KEY`, `VITE_ATTACHMENTS_BUCKET=attachments`. Preview: `VITE_IS_DEMO=true`.
5. Plan: Hobby is for non-commercial use; use Pro for the client app (or the upstream GitHub Pages script).

### A4. Claude Code online
1. claude.ai/code → connect GitHub → give access to `cuera/aparna-atomic-crm`.
2. Create an environment named `aparna-crm`:
   - Network: default (package registries + GitHub). If the setup script cannot download Chromium, allow `cdn.playwright.dev` and `playwright.download.prss.microsoft.com`, or use full access for the MVP week.
   - Environment variables: **none**. No Supabase or Vercel secrets in cloud sessions (ADR-A15).
   - Setup script: `npm ci && (npx playwright install chromium || true)`
3. Optional, recommended: install the Claude GitHub app on the repo so you can comment `@claude review this PR against docs/aparna` for a fresh-context review (the repo already has `.github/workflows/claude.yml`).

### A5. Outside the code (start now, they take time)
1. Fix the website: real phone number and a WhatsApp button (P-01).
2. Start Meta WhatsApp Business verification (needed later for automation, T3).
3. Ask Aparna for: current student list (parent, phone, child, course, fee, due date) and open enquiries, in any format.

## Part B — How every session runs (works from a phone)

1. claude.ai/code → New session → repo `cuera/aparna-atomic-crm`, branch `main`, environment `aparna-crm`.
2. Paste the slice prompt from Part C.
3. Claude replies with a short plan. Reply `go` (or your corrections).
4. Claude builds, tests, opens a PR titled `[M?] …`, waits for the GitHub `Check` run, and updates the docs.
5. Open the PR → Vercel Preview link → check the one thing Claude names. Merge.
6. Next slice = new session. After M1 is merged, run M2 and M3 **at the same time** in two sessions.

Order: M0 → (you: "Gate MVP-A: go") → M1 → M2 ∥ M3 → M4 → M5.

## Part C — Prompts

Every prompt = the COMMON block + one slice block. Replace `<ID>` with the slice id.

### COMMON (paste first, every time)

```text
You are the principal engineer on the Aparna's English Coaching CRM (a fork of Atomic CRM).
Read docs/aparna/README.md, docs/aparna/CLAUDE-aparna.md, docs/aparna/MVP.md, the slice's
features in docs/aparna/features.json, and .claude/rules/karpathy.md. Then run /aparna-loop START.

Rules for this session:
- This session is slice <ID> only. Touch only the files this slice owns (MVP.md section 7 and
  the list below). If you need another file, stop and ask.
- Plan first (files, tests mapped to acceptance lines, verify per feature, risks). No edits until I say "go".
- Tests before code. Evidence = pasted command output. Never "it should work".
- This cloud machine has no Docker. Migrations, pgTAP and e2e are proven by the GitHub Actions
  Check run on your PR. No secrets, no production access. Never push to main.
- Stop condition: every feature of slice <ID> has its cmd: verify green with output pasted, the PR
  "[<ID>] ..." is open, and its Check run is green (pasted) — or stop after 40 turns and report the
  blocker. After I say "go", if /goal is available, set it to exactly this condition.
- Finish with /aparna-loop CLOSE. Last message: PR link, Preview link, the one thing I should check.
```

### M0 — check + Gate MVP-A (no product code)

```text
Slice M0. No product code.
1. Baseline: npm ci, make typecheck, make lint, try make test (report whether Chromium works).
2. Verify these assumptions with file:line evidence and list any that are wrong:
   a) options in src/components/atomic-crm/root/defaultConfiguration.ts reach both src/App.tsx and demo/App.tsx;
   b) how dataProvider.getConfiguration() (DB-stored settings) overrides those defaults in production;
   c) the deals Kanban reads stages from configuration;
   d) where to relabel Deal -> Admission and Contact -> Parent (i18n) and how to hide Companies from the menu;
   e) src/components/atomic-crm/dataImport can host two new importers;
   f) .github/workflows/check.yml e2e job starts Supabase, so an `npx supabase test db` step can run there;
   g) .github/workflows/deploy.yml pushes migrations with the 5 secrets; which of its other jobs need extra setup.
3. Dispatch the gate-reviewer agent, MODE gate, gate "MVP-A", files: docs/aparna/MVP.md, TRANSITION.md,
   decisions.md (ADR-A11..A16), features.json (M- features), CLAUDE-aparna.md, .claude/skills/aparna-loop/SKILL.md.
   Do not review it yourself; relay its scorecard verbatim.
4. Record results in progress.md; wrong assumptions and findings -> problems.md with proposed fixes.
   Do not edit MVP.md, TRANSITION.md or decisions.md yet.
5. Open PR "[M0] Gate MVP-A check" with only these doc changes. Show me in under 20 lines: baseline,
   wrong assumptions, score, proposed fixes, decisions needing my go. Then stop.
```

After M0 you reply in the same session: `Gate MVP-A: go. Apply the fixes I approved, mark ADR-A11..A16 Accepted, record the gate in progress.md, update the PR.` Then merge it.

### M1 — Foundation (schema frozen when merged)

```text
Slice M1 (features M-101..M-107).
Owned files: supabase/schemas/*, one new migration in supabase/migrations/, supabase/tests/mvp_constraints.test.sql,
src/components/atomic-crm/types.ts, root/defaultConfiguration.ts, i18n messages, the menu/layout file that lists
Companies, providers/fakerest/dataGenerator/*, .github/workflows/check.yml (add `npx supabase test db` after
Supabase starts in the e2e job), e2e/aparna/mvpBoard.spec.ts, and deploy.yml only if a job must be disabled.
Notes: hand-write the migration to match the declarative schema change exactly (ADR-A15); keep contacts_summary
valid; demo data must be realistic (Indian and foreign parents, all stages, enrolled students with fees).
Before showing me the plan, dispatch gate-reviewer MODE plan on it and fix its findings.
M-107 is manual: at the end give me the exact clicks to finish the deploy and the Owner's first sign-up.
```

### M2 — Capture and discipline (run in parallel with M3, after M1 is merged)

```text
Slice M2 (features M-201..M-205). Depends on M1 merged.
Owned files: src/components/atomic-crm/misc/phone.ts (+ test), quick-add components under contacts/,
deals form, card and Kanban drag handling under deals/, their tests, package.json/package-lock.json for
libphonenumber-js only (respect .npmrc min-release-age). Do NOT touch root/CRM.tsx, types.ts or schema files.
```

### M3 — Today and one-tap WhatsApp (run in parallel with M2, after M1 is merged)

```text
Slice M3 (features M-301..M-306). Depends on M1 merged.
Owned files: src/components/atomic-crm/today/*, src/components/atomic-crm/whatsapp/*,
src/components/atomic-crm/misc/time.ts (+ test), and the route + default landing lines in root/CRM.tsx.
For wa.me links use contacts.phone_e164 without the "+"; do not import M2's phone helper.
Template texts: short, warm, plain English, signed "Aparna's English Coaching". List them in the PR body
so the Owner can approve the wording.
```

### M4 — Import (after M2 is merged)

```text
Slice M4 (features M-401, M-402). Depends on M2 merged (uses the phone helper).
Owned files: new importers, sample CSVs and tests under src/components/atomic-crm/dataImport/, and the
import button wiring for them. Dry run must list row errors and duplicate phones before anything is written.
```

### M5 — Pilot week

```text
Slice M5 (features M-501..M-503).
1. Write docs/aparna/COUNSELLOR-GUIDE.md: one page, plain language, numbered steps for a day's work
   (open Today, add an enquiry, send a message, set the next follow-up, mark fee paid, move to Lost).
2. During the pilot I will paste issues here. For each: fix it in this slice if small and inside MVP scope,
   otherwise add a row to problems.md and defer it. Keep the PR updated.
3. At the end, fill the baseline table in progress.md from the This-week strip numbers I give you,
   and propose the first full-build slice using TRANSITION.md section 3.
```

### When Claude gets something wrong (any session)

```text
Encode this fix: <what went wrong>. Add a row to docs/aparna/problems.md and put the fix at the strongest
layer that holds it (hook or DB constraint > .claude/rules > docs/aparna/CLAUDE-aparna.md > skill). Show the diff.
```

### Later — start the full build

```text
Start the full build. Read docs/aparna/TRANSITION.md and the pilot numbers in progress.md. Propose the slice
order using TRANSITION.md section 3 (T5 before any Teacher account), re-run the verify of every feature in
TRANSITION.md section 2, then run Gate A with the gate-reviewer. Stop for my go.
```

## Part D — How the orchestration fits together

1. **Loop** = one slice: plan → tests → build → verify → fresh review → close (`project_plan.md` §5).
2. **Graph of loops** = the slice dependency graph with gates (`project_plan.md` §2). You are the gate.
3. **Parallel** = separate cloud sessions (each its own machine and branch), only after the schema is frozen, max 2, with file ownership (ADR-A16).
4. **Stop conditions** = `/goal` or the stop sentence in COMMON; always provable from pasted output.
5. **Fresh-context review** = `gate-reviewer` / `quality-reviewer` subagents, or `@claude` on the PR.
6. **Hard rules** = hooks (upstream), DB constraints and CI checks; docs alone enforce nothing (R-1).
7. **Memory** = `docs/aparna/CLAUDE-aparna.md` + `progress.md` + `features.json`, updated by `/aparna-loop` CLOSE.
8. **Big slices later** = upstream agent team in one session: `#technical-harness GATE: plan`.

## Part E — Optional local checks on WSL (before each gate)

```bash
cd aparna-atomic-crm && git pull
make install && make start
npx supabase db diff --local        # expect: no schema changes (no drift)
npx supabase test db                # pgTAP
make stop
```
