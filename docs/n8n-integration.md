# n8n Integration Guide — Hatch CRM

## Connection Setup

n8n connects to Supabase via the **Postgres pooler** (session mode, port 6543).

### Connection String

```
postgresql://postgres.<YOUR_PROJECT_REF>:[DB_PASSWORD]@aws-0-<YOUR_REGION>.pooler.supabase.com:6543/postgres
```

To find the exact values:
1. Go to **Supabase Dashboard** → Project Settings → Database
2. Copy the **Session mode** connection string under "Connection Pooling"
3. The database password is the one set during project creation (check your password manager)

### n8n Postgres Credential Setup

1. In n8n, go to **Credentials** → **New Credential** → **Postgres**
2. Fill in:
   - **Host:** `aws-0-<YOUR_REGION>.pooler.supabase.com`
   - **Port:** `6543`
   - **Database:** `postgres`
   - **User:** `postgres.<YOUR_PROJECT_REF>`
   - **Password:** Your database password
   - **SSL:** Enable (required for Supabase cloud)
3. Click **Test Connection** to verify

## Integration Tables

n8n workflows read and write to these tables:

| Table | Owner | n8n Access | Purpose |
|-------|-------|------------|---------|
| `companies` | CRM UI | Read | Enrich leads, trigger workflows |
| `contacts` | CRM UI | Read | Lookup contacts for notifications |
| `deals` | CRM UI | Read/Write | Update deal stages, trigger on new deals |
| `integration_log` | n8n / Edge Functions | Write | Log all integration events |
| `n8n_workflow_runs` | n8n | Write | Track workflow execution history |
| `audit_results` | Audit System | Read | Pull audit data for reports |

### integration_log Schema

Every n8n workflow must log its activity to `integration_log`:

```sql
INSERT INTO integration_log (source, action, entity_type, entity_id, payload, result)
VALUES ('n8n', 'workflow_name', 'deal', '<deal_id>', '{"trigger_row_id": "<trigger_id>"}'::jsonb, '{"status": "success"}'::jsonb);
```

Fields:
- `source`: Always `'n8n'` for n8n workflows
- `action`: The workflow name or action taken (e.g., `'new_deal_notification'`)
- `entity_type`: The table/resource acted on (e.g., `'deal'`, `'contact'`)
- `entity_id`: ID of the affected record stored as text (cast bigint IDs to text)
- `payload`: JSONB with request or trigger context
- `result`: JSONB result payload such as `{"status": "success"}` or `{"error": "..."}`

### n8n_workflow_runs Schema

For tracking workflow execution:

```sql
INSERT INTO n8n_workflow_runs (workflow_id, workflow_name, status, started_at, completed_at, trigger_table, trigger_row_id, result, error)
VALUES ('workflow-id', 'New Deal Notification', 'completed', now(), now(), 'deals', '<id>', '{"status": "success"}'::jsonb, NULL);
```

## Sample Workflow: New Deal Notification

A starter workflow that logs new deals to `integration_log`:

### Trigger: Supabase Postgres Trigger (or Polling)

**Option A — Polling (simpler, recommended to start):**
1. **Schedule Trigger** → every 5 minutes
2. **Postgres** node → `SELECT * FROM deals WHERE created_at > $now - interval '5 minutes'`
3. **IF** node → check if any rows returned
4. **Postgres** node → INSERT into `integration_log`

**Option B — Webhook (requires Supabase Realtime or pg_notify):**
- More complex setup, use after polling is proven

### Workflow Steps

```
[Schedule Trigger: 5min]
    → [Postgres: Query new deals]
    → [IF: Has new deals?]
        → Yes: [Postgres: Log to integration_log]
        → No: [No Operation]
```

## Supabase Free Tier Considerations

The free tier auto-pauses after 1 week of inactivity. To prevent this:

1. **Heartbeat workflow:** Create an n8n workflow that runs a simple `SELECT 1` query every 6 days
2. This keeps the Supabase project active without meaningful resource usage
3. When revenue starts, upgrade to Pro ($25/mo) to remove the pause behavior

## RLS Notes

All tables have Row Level Security enabled. n8n connects as the `postgres` role (via the database password, not the anon key), which **bypasses RLS**. This is intentional — n8n is a trusted backend integration.

If you need RLS-aware access from n8n, use the Supabase JS client with the service role key instead of direct Postgres.

## Troubleshooting

| Issue | Fix |
|-------|-----|
| Connection refused | Check SSL is enabled. Verify port is 6543 (pooler), not 5432 (direct). |
| Authentication failed | Verify the password. The user is `postgres.<YOUR_PROJECT_REF>` (with the project ref prefix). |
| Permission denied | The postgres role should have full access. Check if the table exists. |
| Supabase paused | Visit the Supabase dashboard to wake it, or set up the heartbeat workflow. |
| Timeout on large queries | Use the pooler's session mode (6543). Add `LIMIT` to queries. |
