# Deal Proposal Generator — Design

**Date**: 2026-04-20
**Status**: Approved (awaiting implementation plan)
**Author**: tg + Claude

## Goal

Add a "Générer proposition commerciale" action to the deal detail page. The action sends deal/company/contact data to the external Nosho Proposal Generator and persists the two returned URLs (`editUrl` for the sales rep, `publicUrl` for the client) on the deal.

## Non-goals (v1)

- Distinct "Devis" flow — deferred to v2
- Conversational trigger via Nosho AI Assist — deferred to v2+ (will reuse the edge function built here)
- Custom ROI fields on the deal
- Version history of generated proposals
- Regenerating from an archived/won deal (no special handling)

## External API contract

- `POST https://nosho-doc-generator.nosho-ai.workers.dev/api/proposals`
- Header `X-API-Key: <secret>` — server-side only, never in the browser
- Body: all fields optional (see "Payload mapping" below)
- Response 201:
  ```json
  {
    "id": "7w7ppqawfj",
    "editUrl":   "https://.../edit/<id>?t=<edit-token>",
    "publicUrl": "https://.../p/<id>",
    "apiUrl":    "https://.../api/proposals/<id>",
    "status": "draft",
    "createdAt": "..."
  }
  ```

## Architecture

```
[DealShow page]
   │ click "Générer proposition"
   ▼
[Dialog: pick contact (default = contact_ids[0])]
   │ submit
   ▼
[Edge function: generate-proposal]
   │ fetch deal + company + chosen contact + sales owner
   │ idempotence check
   │ build payload
   │ POST Nosho API with X-API-Key
   │ UPDATE deals SET proposal_edit_url, proposal_public_url
   ▼
[UI: invalidate deal, render URLs on deal page]
```

All Nosho API calls go through the Supabase edge function. The API key is never exposed to the browser and never logged.

## Database changes

### Migration: add proposal URL columns to `deals`

Add to `supabase/schemas/01_tables.sql`, table `deals`:

```sql
proposal_edit_url text,
proposal_public_url text
```

Both nullable. No index needed (displayed, not queried).

### View update: `deals_summary`

Add `proposal_edit_url` and `proposal_public_url` to the `deals_summary` view in `supabase/schemas/03_views.sql` so the frontend receives them via the default list/show queries.

### Migration generation

```bash
npx supabase db diff --local -f add_proposal_urls
npx supabase migration up --local
```

Then (before merge to main):
```bash
make supabase-push
```

## Edge function: `supabase/functions/generate-proposal/index.ts`

### Secrets

- `NOSHO_API_KEY` — required. Set via `supabase secrets set NOSHO_API_KEY=<value>` for remote, and in `supabase/.env.local` for local dev.
- Fail fast with a 500 + server log if missing.

### Middleware

Reuse the existing pattern:
- `OptionsMiddleware` (CORS preflight)
- `AuthMiddleware` (requires a valid Bearer token)
- `UserMiddleware` if the authenticated user needs to be resolved to a sales row (used for `senderName` in the payload)

### Request contract

```ts
POST /functions/v1/generate-proposal
Authorization: Bearer <user jwt>
Content-Type: application/json

{
  "dealId": number,     // required
  "contactId": number | null,  // optional; null = no contact on the payload
  "force": boolean      // optional; default false — bypasses idempotence check
}
```

### Response contracts

**200 OK** (generated or regenerated):
```json
{ "editUrl": "...", "publicUrl": "..." }
```

**409 Conflict** (idempotence: URLs already exist, `force` not set):
```json
{
  "error": "proposal_already_exists",
  "editUrl": "...",
  "publicUrl": "..."
}
```

**400 Bad Request** (Nosho API returned 400 — forward Zod issues):
```json
{ "error": "invalid_payload", "issues": [...] }
```

**502 Bad Gateway** (Nosho API returned 401 — bad API key):
```json
{ "error": "nosho_api_key_invalid" }
```

**504 Gateway Timeout** (Nosho API timeout >15s):
```json
{ "error": "nosho_timeout" }
```

**500 Internal Server Error** (missing secret, DB error, unexpected):
```json
{ "error": "internal_error" }
```

### Behavior

All Supabase queries in this function use a client initialized with the **user's JWT** (forwarded from the `Authorization` header). This ensures Row-Level Security applies end-to-end — the user must have access to the deal they're generating for, and to the contact they select.

1. Parse body. Reject with 400 if `dealId` is missing/invalid.
2. Fetch the deal (with company name, `contact_ids`, `sales_id`, `proposal_edit_url`, `proposal_public_url`). Reject 404 if not found (RLS-filtered).
3. Idempotence check: if `proposal_public_url` is set and `force !== true` → return 409 with existing URLs.
4. Resolve the sales owner from `sales` (via `deal.sales_id`) for `senderName`.
5. Resolve the chosen contact:
   - If `contactId` is provided: fetch it. Validate it belongs to `deal.contact_ids`. If not → return 400 `contact_not_in_deal`.
   - If `contactId` is null/absent and `deal.contact_ids[0]` exists: fetch it.
   - Otherwise: no contact — omit `clientContact` from the payload.
6. Build payload (see mapping below).
7. `fetch` POST to Nosho API with `X-API-Key`, 15s timeout via `AbortController`.
8. On success: `UPDATE deals SET proposal_edit_url = :editUrl, proposal_public_url = :publicUrl WHERE id = :dealId`.
9. Return `{ editUrl, publicUrl }`.

### Payload mapping

| Nosho field | CRM source | Fallback |
|---|---|---|
| `clientName` | `companies.name` | — (required input) |
| `clientType` | `companies.sector` | omit if null |
| `clientContact` | `${contact.first_name} ${contact.last_name}` | omit if no contact |
| `proposalRef` | `` `NSH-${YYYY}-${dealId}` `` (e.g., `NSH-2026-1337`) | always set |
| `proposalDate` | today in French format (e.g., `20 avril 2026`) | always set |
| `senderName` | `` `${sales.first_name} ${sales.last_name}` `` | omit if sales missing |
| `senderRole` | — | omit (use API default) |
| all other fields (scope, pricing, roi, show, custom*) | — | omit (use API defaults) |

### Security & logging

- `editUrl` is never logged. Only log `proposalId`, `dealId`, and response status.
- The API key is read once at function start; never included in error messages returned to the client.

## Frontend

### New component: `GenerateProposalAction.tsx`

Location: `src/components/atomic-crm/deals/GenerateProposalAction.tsx`

Rendered inside the header action row of `DealShow.tsx`, alongside `Create Task` / `Archive` / `Edit`.

**State A — no URLs yet** (`deal.proposal_public_url` is null):
- Button `Générer proposition` (outline, size=sm, `FileText` icon)
- Click → opens `GenerateProposalDialog`

**State B — URLs exist**:
- Small inline display: badge `Proposition générée`
- Two icon-buttons linking out (new tab):
  - `Édition` (opens `proposal_edit_url`)
  - `Version client` (opens `proposal_public_url`)
- Secondary button `Régénérer` → opens `RegenerateConfirmDialog`

### `GenerateProposalDialog`

- Title: `Générer une proposition commerciale`
- Field: `Contact destinataire` — dropdown of contacts linked to the deal, default-selected to `contact_ids[0]`
- If `deal.contact_ids` is empty: warning banner `Aucun contact lié à l'opportunité. Le document sera généré sans nom de contact.` and the dropdown is hidden.
- Footer: `Annuler` + `Générer` (loading state while pending)
- On success: close dialog, invalidate the deal query, show toast `Proposition générée`
- On error: show toast with the error payload from the edge function (e.g., `issues` for 400, generic message otherwise)

### `RegenerateConfirmDialog`

- Title: `Régénérer la proposition ?`
- Body: `Les liens existants seront écrasés et ne seront plus accessibles. Cette action est irréversible.`
- Footer: `Annuler` + `Régénérer`
- On confirm → same flow as generate but with `force: true`

### Hook: `useGenerateProposal.ts`

- React Query mutation
- Calls the edge function using the authenticated Supabase client (Bearer token auto-injected)
- On success: invalidates the deal query so the UI re-fetches with the new URLs

## Error handling surface

| Scenario | Backend returns | UI toast |
|---|---|---|
| Network / unknown | any 5xx without body | `Impossible de générer la proposition. Réessayez.` |
| API key invalid | 502 `nosho_api_key_invalid` | `Clé API invalide. Contactez l'administrateur.` |
| Payload rejected | 400 with `issues` | `Données invalides : <first issue.message>` |
| Contact not linked to deal | 400 `contact_not_in_deal` | `Ce contact n'est pas lié à l'opportunité.` |
| Timeout | 504 `nosho_timeout` | `Le service est indisponible, réessayez plus tard.` |
| Already generated (no force) | 409 with URLs | no toast — UI falls back to State B |

## Testing

### Sanity check (manual, pre-implementation)
- Get `NOSHO_API_KEY` from the user
- Run the curl from the spec to verify 201 + `editUrl` opens the editor
- Only proceed to code if this passes

### Automated
- Unit test for the payload builder (pure function, deal+contact+sales → JSON). Covers: all fields present, missing sector, missing contact, missing sales.
- Unit test for idempotence logic (URLs present + no force → 409).

### Manual end-to-end
1. Open a deal without URLs → click `Générer` → pick contact → confirm success → URLs appear on deal
2. Refresh the deal page → URLs still there (persistence OK)
3. Click `Régénérer` → confirm → URLs update
4. Open `editUrl` in a new tab → editor loads
5. Open `publicUrl` in a new tab → public page loads

## Rollout

1. Merge PR → preview deploy on Coolify
2. Run `make supabase-push` to apply migration to the remote DB
3. Set `NOSHO_API_KEY` via `supabase secrets set` on the remote project
4. Validate on the preview URL with a real deal
5. Promote to production

## Open questions (deferred)

- Should we track *who* generated the proposal and when? (v2 — add `proposal_generated_at` + `proposal_generated_by`)
- Should regeneration be restricted (e.g., only the deal owner or admins)? Currently any user with RLS access to the deal can regenerate.
- Do we want a soft-archive of previous URLs on regeneration? (v2 if needed)
