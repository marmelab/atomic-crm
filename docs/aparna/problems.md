# problems.md — problems encountered (and how each was encoded)

**Status:** LAW for its "encoded as" column (an entry without it is still open).
**Role:** Every failure, surprise or near-miss, during planning and building. Encode-the-fix: each fix goes into the system (hook > rule > CLAUDE fact > skill), not only into one file. Newest at the bottom.

| ID | Date | Problem | Impact | Fix / status | Encoded as |
|---|---|---|---|---|---|
| P-01 | 2026-11-20 | Client website shows placeholder phone `9876543210` and email `email@gmail.com` | Website enquiries cannot reach the business | Fix on the website (outside this repo) in S0 | `progress.md` S0 checklist |
| P-02 | 2026-11-20 | Fees, joins per month and leavers per month unknown | Metrics M5, M7, M8 and ROI cannot be baselined | Ask founder before Gate A (Q1, Q2) | PRD §14 open questions |
| P-03 | 2026-11-21 | GitHub API not available in the planning chat session | Repo stats taken from public web pages instead | Inspect the cloned repo directly | — (planning tool limit, no code impact) |
| P-04 | 2026-11-21 | Root `CHANGELOG.md` is regenerated from upstream releases by `npm run update-changelog` | Our changelog entries would be overwritten | Keep ours in `docs/aparna/CHANGELOG.md` | ADR-A10 + `CLAUDE-aparna.md` fact |
| P-05 | 2026-11-21 | Root `CLAUDE.md`/`AGENTS.md` are upstream-owned | Our edits would conflict on upstream merges | One import line only; memory in `docs/aparna/CLAUDE-aparna.md` | ADR-A10 |
| P-06 | 2026-11-21 | Upstream RLS policies are `using (true)` for all authenticated users | Teachers would see fees and all families | Replace policies in S1 with per-role tests | ADR-A07 + F-101, F-503 |
| P-07 | 2026-11-21 | Upstream added then dropped `deals.lost_reason` | Re-adding looks like a mistake to a reviewer | Documented as deliberate | ADR-A03 + `CLAUDE-aparna.md` gotcha |
| P-08 | 2026-11-21 | Harness smoke test runs in FakeRest demo mode | New resources without generators break the smoke run | Every new resource ships a FakeRest generator | ARCHITECTURE §3 + `CLAUDE-aparna.md` fact |
| P-09 | 2026-11-21 | Meta pricing changed on 1 Oct 2026 (utility charged inside the 24 h window; 1,000 free service replies per number) | Older cost estimates are wrong | Cost recalculated in ARCHITECTURE §6, §10 | `risks.md` R-9 |
| P-10 | 2026-11-21 | Planning mistake: a `docker info` check in the planning chat sandbox (no daemon, 2 CPUs) was assumed to hold for Claude Code cloud sessions. The official docs say cloud sessions ship docker, dockerd and docker compose, 4 vCPUs, 16 GB RAM, and the Trusted allowlist includes Docker Hub, ghcr.io and public.ecr.aws | The first MVP plan pushed every Docker check to CI and asked for hand-written migrations | Cloud sessions run the full local stack (`make start`, `supabase db diff`, pgTAP, e2e); CI stays as the second verifier; M0 confirms with `docker info` | ADR-A15 revised + `CLAUDE-aparna.md` Mistakes Log + M-001 acceptance |
| P-11 | 2026-11-21 | `demo/App.tsx` renders `<CRM>` without the props in `src/App.tsx` | Domain config set only in `src/App.tsx` would be missing from Vercel Preview (demo mode) | Put domain options in `root/defaultConfiguration.ts`; check DB-stored configuration in M0 | `MVP.md` §4 + `CLAUDE-aparna.md` gotcha |

## Provenance & audit
Sources: discovery chat (20 Nov 2026), repo inspection (21 Nov 2026), Meta pricing pages.
Checked: every row has an "encoded as" or a reason why not.
