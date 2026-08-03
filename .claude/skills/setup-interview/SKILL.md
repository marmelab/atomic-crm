---
name: setup-interview
description: Domain-by-domain interview to produce $CLAUDE_PROJECT_DIR/docs/project-context.json. Invoked once by the orchestrator; the orchestrator then conducts all turns directly using Read/Write/Edit — no agent dispatching.
---

## Overview

A domain-by-domain interview that produces `$CLAUDE_PROJECT_DIR/docs/project-context.json`. You drive it one user turn at a time, persisting after each domain, until the user confirms — exit criterion: a `validated: true` JSON committed and the `VALIDATED` token emitted.

**Scope constraint**: during SETUP-INTERVIEW, your Write / Edit tools are
restricted to `$CLAUDE_PROJECT_DIR/docs/project-context.json` only. Never touch `$CLAUDE_PROJECT_DIR/src/` or
any other path.

## When to Use

- Invoked once by the orchestrator at the start of project setup; the orchestrator then conducts every turn directly.
- Resuming an interrupted interview (`validated: false`) or updating an existing config (`validated: true`).

---

## FIRST ACTION — startup detection

`Read("$CLAUDE_PROJECT_DIR/docs/project-context.json")`:

| State | Action |
|---|---|
| File missing | Start a FRESH interview from domain 1. |
| File exists, `validated: true` | Summarize existing config (template below) and ask: (a) update specific domains, or (b) restart from scratch. |
| File exists, `validated: false` | Resume from the last `pending` entry in `interview_progress`. |

### Existing-config summary template (validated == true)

Output a plain-text message to the user (translate into the user's language at runtime):

```
Here's what I already know about your project:
- Industry: <industry>
- Team size: <team_size>
- Client type: <client_type>
- Main objective: <objective>
- <N> entities defined: <comma-separated names>
- Pipeline: <pipeline_stages joined>
- <N> user roles

Would you like to:
(a) update part of this config (I'll go domain by domain),
(b) start from scratch (I'll wipe everything and redo the full interview)?
```

- Update intent → **UPDATE flow**: for each domain, ask "Current value: `<…>`. Keep as-is, or change it?"
- Restart intent → delete the file, start FRESH.

---

## Per-turn loop (FRESH and UPDATE flows)

Each user turn during SETUP-INTERVIEW:

1. `Read("$CLAUDE_PROJECT_DIR/docs/project-context.json")` — load current state.
2. Apply the user's latest answer to the relevant domain section.
3. Update `interview_progress.domain_N` to `"done"`, keep `validated: false`.
4. `Write("$CLAUDE_PROJECT_DIR/docs/project-context.json", <full updated JSON>)`.
5. Move to the next pending domain.
6. Output **exactly one** of:
   - The next question as a **plain text message** to the user (no prefix, no wrapper).
   - `VALIDATED` — when final confirmation is received (see Final validation).
   - `FAILED: <reason>` — unrecoverable error.

Summarize what you understood after each domain and wait for confirmation before
moving to the next. Never ask multiple domains in one turn.

---

## Domain questions

### Domain 1 — Business context
- Industry, team size, client type (B2B / B2C / mixed), main objective
  (prospecting, follow-up, support, other).

### Domain 2 — Entities
- What objects are managed? Relationships between them?
- ⚠️ If an entity resembles `contact`, `company`, `deal`, `tag`, `task`, or
  `note` (already in Atomic CRM) → propose extending it (`"type": "extend"`)
  rather than recreating it.

### Domain 3 — Custom fields
- Specific fields per entity beyond standard fields.
- Type of each field (text / number / date / boolean / list / file).
- Required vs optional.

### Domain 4 — Pipeline
- Sales or follow-up cycle stages, transition conditions, final stages
  (won / lost / archived).

### Domain 5 — User roles
- Who uses the CRM (sales / manager / admin / support).
- Rights per role: read-only / write / delete / admin.
- Multi-tenant needed (data isolated per team)?

### Domain 6 — Integrations
- Email (read / send / tracking)? Slack or other messaging?
- CSV import/export? Inbound or outbound webhooks? External API?

### Domain 7 — UI/UX
- Interface language, theme (light / dark / auto), desired dashboards
  (KPIs / charts / lists), information density preferences.

### Domain 8 — Deployment *(skip entirely when MODE=demo)*
- GitHub username, Supabase project name, deployment platform
  (Vercel recommended, or GitHub Pages), custom domain.

---

## Cleanup derivation (run after all domains, before consistency checks)

Atomic CRM ships with default entities and features the user may not need.
Before final validation, derive what should be removed to keep the CRM clean.

**Default Atomic CRM elements** (candidates for removal):

| Element | Remove when… |
|---|---|
| `company` entity | User manages individuals only (no B2B account layer) |
| `deal` entity | No sales pipeline — user tracks contacts/support only |
| `task` entity | User did not mention task management |
| `tag` entity | User did not mention categorisation / labelling |
| Pipeline / kanban view | `deal` entity is removed, or no stage-based flow requested |
| Analytics dashboard | User did not mention KPIs, charts, or reporting |
| CSV import/export | User did not mention data migration or bulk operations |
| Multi-tenant / teams | Domain 5 answered "no" to data isolation per team |

**Steps:**

1. Compare domain answers against the table above. Derive a candidate removal list.
2. Present it to the user as a **plain text message**, translated to their language.

   **Language rule (strict):** describe only what the user *sees* in the
   interface — sections, screens, buttons. Never mention entities, tables,
   components, types, or any technical term. The user interprets the
   business meaning; you handle the technical implications internally.

   Example (translate at runtime):
   ```
   Based on what you told me, it looks like you won't need these sections
   in your CRM — I can remove them to keep things clean:
   - <plain-language feature name>: <one-sentence business reason>
   - …

   Does that sound right? Anything you'd like to keep?
   ```

   Plain-language names to use (never the internal names):
   | Internal | Say to user |
   |---|---|
   | `company` entity | the "Companies" section |
   | `deal` entity | the "Deals" or "Sales pipeline" section |
   | `task` entity | the "Tasks" section |
   | `tag` entity | the label / tag feature |
   | Pipeline / kanban | the pipeline / kanban board view |
   | Analytics dashboard | the analytics and reporting section |
   | CSV import/export | the data import and export feature |
   | Multi-tenant | team-based data isolation |
3. On user confirmation (or "all good"): populate `cleanup` in the JSON and Write.
4. On user adjustment ("keep X"): remove X from the list, update JSON.

If no element qualifies for removal: skip this step silently (no question asked).

Store the result in the JSON under `"cleanup"` before writing:

```json
"cleanup": {
  "entities_to_remove": ["company", "tag"],
  "features_to_disable": ["pipeline", "analytics_dashboard", "csv_import_export"]
}
```

## Consistency checks (run before final validation)

- No duplicate field names within the same entity.
- Every entity referenced in `pipeline_stages` exists in `entities`.
- Every role in `user_roles` has at least one permission defined.
- Existing Atomic CRM entities marked `"type": "extend"`, not `"type": "create"`.
- No service-role key or secret in client-side variables.

If a check fails: output one targeted `INTERVIEW:` question to fix it before
proceeding to validation.

---

## Final validation

When all 8 applicable domains are `"done"`:

1. Read the JSON. Produce a compact plain-language summary in the user's
   language.
2. Output a plain-text message asking for confirmation (translate at runtime):
   > *"<summary>. All good? I'll lock the project spec. (yes / no)"*
3. On any affirmative (yes / ok / valid / go / looks good, in any language):
   a. Set `validated: true`. `Write` the file.
   b. `Bash("cd \"$CLAUDE_PROJECT_DIR\" && git add docs/project-context.json && git commit -m \"chore(setup): <fresh|update> project context\"")`
   c. Output `VALIDATED` — the orchestrator moves to SETUP-PLAN. No additional
      text after this token.
4. On negative: ask which domain to revisit; re-enter that domain's questions.

---

## Output format (strict)

Every orchestrator turn during SETUP-INTERVIEW ends with **exactly one** of:

| Output | Meaning |
|---|---|
| Plain text question | Ask the user the next domain question directly; re-enter this skill on the next user turn. No wrapper, no prefix. |
| `VALIDATED` | JSON committed. Move to STATE SETUP-PLAN. |
| `FAILED: <reason>` | Unrecoverable error; surface to user, abort setup. |

---

## JSON schema

```json
{
  "validated": false,
  "bootstrapped": false,
  "project_name": "...",
  "github_username": "...",
  "supabase_project_name": "...",
  "deploy_platform": "vercel|github-pages",
  "mode": "demo|full",
  "business_context": {
    "industry": "...",
    "team_size": 0,
    "client_type": "B2B|B2C|mixed",
    "objective": "..."
  },
  "entities": [
    {
      "name": "ticket",
      "type": "create|extend",
      "base_entity": null,
      "fields": [
        { "name": "subject", "type": "text", "required": true }
      ]
    }
  ],
  "pipeline_stages": ["open", "in_progress", "resolved"],
  "user_roles": [
    { "name": "admin", "permissions": ["read", "write", "delete"] }
  ],
  "integrations": [],
  "ui": { "language": "en", "theme": "light|dark|auto" },
  "cleanup": {
    "entities_to_remove": [],
    "features_to_disable": []
  },
  "interview_progress": {
    "domain_1": "done",
    "domain_2": "pending",
    "domain_3": "pending",
    "domain_4": "pending",
    "domain_5": "pending",
    "domain_6": "pending",
    "domain_7": "pending",
    "domain_8": "pending"
  },
  "phase_status": {
    "spec":     { "status": "pending" },
    "fork":     { "status": "pending" },
    "supabase": { "status": "pending" },
    "env":      { "status": "pending" },
    "deploy":   { "status": "pending" }
  },
  "tickets": []
}
```

The `tickets` array is populated later by `planner` in SETUP_MODE — leave it
empty here.

---

## Red Flags

- Asking more than one domain in a single turn, or skipping the per-domain confirmation.
- Writing or editing any path other than `docs/project-context.json`.
- Setting `validated: true` before the consistency checks pass.
- Mentioning entities, tables, components, or other technical terms to the user (use plain-language feature names).
- An entity resembling a built-in (`contact`/`company`/`deal`/`tag`/`task`/`note`) marked `"type": "create"` instead of `"extend"`.
- A service-role key or secret stored in a client-side variable.
- Emitting anything other than exactly one output contract (plain-text question / `VALIDATED` / `FAILED:`) per turn.

## Verification

Before emitting `VALIDATED`:

- [ ] All 8 applicable domains are `"done"` (domain 8 skipped when `MODE=demo`).
- [ ] All consistency checks pass (no duplicate fields, pipeline entities exist, every role has a permission, built-ins use `"extend"`, no client-side secrets).
- [ ] The `cleanup` derivation was presented in plain language and confirmed (or skipped silently when nothing qualified).
- [ ] The user gave an affirmative final confirmation.
- [ ] `validated: true` written, JSON committed, and `VALIDATED` is the only output (no trailing text).
