# KICKOFF.md — start the build from your terminal

Requires: Node (version in `.nvmrc`), Docker (for local Supabase), Claude Code v2.1.139+ (for `/goal`). On Windows run everything inside WSL (risk R-4).

## Cloud sessions (Claude Code on the web)

Cloud sessions have no Docker daemon (P-10), so the local Supabase stack does not run there. Split the work:

| Work | Where |
| --- | --- |
| UI, components, FakeRest generators, unit tests (`make typecheck`, `make lint`, `make test`) | Cloud session (`make start-demo` for the UI) |
| Edge functions + their Vitest tests (`npm run test:unit:functions`) | Cloud session |
| Schema edits in `supabase/schemas/` | Cloud session |
| `npx supabase db diff` (migration generation) and `npx supabase test db` (pgTAP) | WSL with Docker, or against a dev Supabase project (try `--linked` / `--db-url`; confirm in P0) |
| Deploys | Vercel Git integration (preview per branch); `npx supabase db push` from WSL or CI |

One-time setup for cloud sessions:

1. In the cloud environment settings, allow network access to `*.supabase.co`, `api.supabase.com` and `api.vercel.com` (the default allowlist covers package registries only).
2. Add environment variables: `SUPABASE_ACCESS_TOKEN`, `SUPABASE_PROJECT_REF` (dev project), `SUPABASE_DB_PASSWORD`.
3. In Vercel, import the repo, build command `npm run build`, output `dist`, and set `VITE_SUPABASE_URL` and `VITE_SB_PUBLISHABLE_KEY` (the Supabase–Vercel integration creates differently named variables; map them to these names).
4. Production on Vercel needs a Pro plan (Hobby is for non-commercial use), or deploy to GitHub Pages with the upstream script.

In Prompt 1, step 2 becomes: run `make install`, `make typecheck`, `make test`, `make start-demo`; skip `make start` and report which DB checks need WSL or the dev project.

## 0. One-time setup

```bash
git clone https://github.com/cuera/aparna-atomic-crm.git
cd aparna-atomic-crm
git checkout plan/aparna-crm-p0
claude
```

Inside Claude Code press **Shift+Tab twice** (plan mode), then paste Prompt 1.

## Prompt 1 — P0 + Gate A (one shot, stops at the gate)

```text
You are the principal engineer for the Aparna's English Coaching CRM (fork of Atomic CRM).
This session is P0: environment + Gate A. Write NO product code in this session.

Read docs/aparna/README.md first and follow its reading order. Then:

1. Handover check: state the source-of-truth hierarchy, list every open decision
   (ADRs with Status Proposed, PRD §14 questions), and say which rules come from
   upstream (AGENTS.md, .claude/rules) versus our pack (docs/aparna).
2. Environment: run `make install`, `make start`, `make typecheck`, `make test`.
   Report each as PASS/FAIL with the decisive output lines. If a tool is missing
   (Docker, Node version), stop and tell me exactly what to install.
3. Reality check of the plan against the code. Verify these assumptions and list
   any that are wrong, with file:line evidence:
   a) deal stages and labels are configurable from src/App.tsx props and i18n;
   b) src/components/atomic-crm/dataImport can host new importers;
   c) every new resource needs a FakeRest generator for the harness smoke run;
   d) edge functions follow CORS -> authenticate() -> handler via _shared/;
   e) the block-migration-writes hook only blocks supabase/migrations, not supabase/tests;
   f) `npx supabase test db` (pgTAP) runs on this setup.
4. Dispatch the gate-reviewer agent with MODE gate, gate "A", files:
   docs/aparna/*.md, docs/aparna/features.json, docs/aparna/CLAUDE-aparna.md,
   .claude/rules/karpathy.md, .claude/skills/aparna-loop/SKILL.md.
   Do not review the pack yourself; relay its scorecard verbatim.
5. Record: append a P0 entry to docs/aparna/progress.md (env results + scorecard).
   Each wrong assumption or gate finding -> a row in docs/aparna/problems.md with a
   proposed fix. Do NOT edit PRD.md, ARCHITECTURE.md, decisions.md or features.json
   yet; list the edits you propose.
6. Stop and show me, in under 25 lines: env status, Gate A score and verdict,
   proposed doc fixes, decisions that need my go, questions for the founder,
   and the recommended first slice. Wait for me to reply "Gate A: go".
```

After you reply "Gate A: go" (and approve or change the proposed fixes), ask Claude to apply the fixes, mark the accepted ADRs `Accepted`, set F-002 to passing with the gate evidence, and commit on `plan/aparna-crm-p0`. Merge that branch yourself.

## Prompt 2 — every slice (the loop)

Start a fresh session per slice (`/clear` or a new terminal).

```text
/aparna-loop
```

When it reports the next slice, enter plan mode (Shift+Tab twice) and paste:

```text
Plan slice S<n> from docs/aparna/project_plan.md. Scope: only features with
"slice": "S<n>" in docs/aparna/features.json. Follow .claude/rules/karpathy.md and
the frontend-dev / backend-dev skills. The plan must list: files to change, tests
first (each mapped to an acceptance line), the verify command per feature, schema
changes in supabase/schemas, RLS + pgTAP tests for any new table, FakeRest
generators, and risks. Then dispatch gate-reviewer with MODE plan on your plan and
fix its findings before showing me the final plan.
```

Approve the plan, switch to auto-accept edits, then:

```text
/goal Every feature with "slice": "S<n>" in docs/aparna/features.json has "passes": true, and you have pasted in this conversation the green output of each feature's verify command plus `make typecheck`, `make lint`, `make test` (and `npx supabase test db` if SQL changed). Or stop after 40 turns and report what is blocking.
```

When the goal clears:

```text
Get a fresh-context review of the slice diff (quality-reviewer via the harness or /code-review;
add a security review if auth, RLS, webhooks or payments changed). Fix findings. Then run /aparna-loop CLOSE.
```

Review the branch and merge it yourself.

## Variant — let the agent team build a big slice

```text
#technical-harness GATE: plan
Implement slice S<n> of docs/aparna/project_plan.md. Tickets must map 1:1 to the
features with "slice": "S<n>" in docs/aparna/features.json; acceptance_criteria
come from each feature's acceptance lines. Respect docs/aparna/CLAUDE-aparna.md.
```

Review the tickets at the plan gate, approve, then run `/aparna-loop` CLOSE when the harness stops.
