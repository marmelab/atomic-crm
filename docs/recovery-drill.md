# Recovery Drill — Hatch CRM

Step-by-step procedure for backing up the production database and restoring it to a scratch Supabase project. Run this drill periodically to verify backups are usable.

## Prerequisites

- PostgreSQL client tools installed (`pg_dump`, `psql`)
- Supabase account with ability to create projects
- Production database password (stored in password manager)

## Step 1: Take Production Backup

```bash
# Set the database password
export SUPABASE_DB_PASSWORD='your-production-db-password'

# Run the backup script
bash scripts/backup.sh recovery-drill-$(date +%Y-%m-%d)

# Verify the backup file exists and has content
ls -lh backups/recovery-drill-*.sql
head -20 backups/recovery-drill-*.sql
```

Expected: A `.sql` file in `backups/` containing CREATE TABLE statements and INSERT data.

## Step 2: Create Scratch Supabase Project

1. Go to [app.supabase.com](https://app.supabase.com)
2. Click **New Project**
3. Name it `hatch-crm-recovery-drill` (or similar)
4. Set a database password — save it
5. Select a region (any — this is temporary)
6. Wait for the project to finish provisioning (~2 minutes)
7. Note the project ref from the URL: `app.supabase.com/project/<ref>`

## Step 3: Restore Backup to Scratch Project

```bash
# Set scratch project details
SCRATCH_REF="<scratch-project-ref>"
SCRATCH_PASSWORD="<scratch-db-password>"
BACKUP_FILE="backups/recovery-drill-$(date +%Y-%m-%d).sql"

# Restore the dump
PGPASSWORD="$SCRATCH_PASSWORD" psql \
  -h "db.${SCRATCH_REF}.supabase.co" \
  -p 5432 \
  -U postgres \
  -d postgres \
  -f "$BACKUP_FILE"
```

Expected output: A series of CREATE/INSERT statements. Some errors about existing system objects are normal — the public schema tables should restore cleanly.

If you see `permission denied` errors on system schemas, that's expected. Only the `public` schema data matters.

## Step 4: Verify App Works Against Restored DB

1. Copy the scratch project's URL and anon key from Supabase Dashboard → Settings → API
2. Create a temporary `.env.recovery-test`:

```bash
VITE_SUPABASE_URL=https://<scratch-ref>.supabase.co
VITE_SUPABASE_ANON_KEY=<scratch-anon-key>
VITE_IS_DEMO=false
VITE_ATTACHMENTS_BUCKET=attachments
```

3. Run the CRM against the scratch project:

```bash
cp .env .env.backup
cp .env.recovery-test .env
npm run dev
```

4. Verify in the browser:
   - [ ] Login page loads
   - [ ] Can sign in (create a user in scratch project's Auth first)
   - [ ] Companies list loads with data
   - [ ] Contacts list loads with data
   - [ ] Deals pipeline renders with correct stages
   - [ ] Dashboard shows metrics

5. Restore original environment:

```bash
cp .env.backup .env
rm .env.backup .env.recovery-test
```

## Step 5: Delete Scratch Project

1. Go to Supabase Dashboard → scratch project → Settings → General
2. Click **Delete project**
3. Confirm deletion

Do not leave scratch projects running — they count against your free tier limit.

## Step 6: Log the Drill

Record the result:

| Date | Backup Size | Restore Time | Tables Verified | Result | Notes |
|------|-------------|--------------|-----------------|--------|-------|
| YYYY-MM-DD | X MB | X min | companies, contacts, deals, tags, configuration | PASS/FAIL | Any issues found |

## Troubleshooting

| Issue | Fix |
|-------|-----|
| `pg_dump: error: connection to server failed` | Check password, verify project isn't paused |
| `ERROR: relation already exists` | Normal for system tables. Public schema tables should still restore. |
| `ERROR: permission denied for schema` | Supabase restricts some schemas. Only `public` is needed. |
| Auth doesn't work on scratch | You need to create a user in the scratch project's Auth. The backup only contains the `sales` table, not `auth.users`. |
| Attachments don't load | Storage bucket and files are NOT included in `pg_dump`. Only metadata is restored. |
| Edge functions not available | Edge functions must be deployed separately to the scratch project. Not needed for basic verification. |

## Recovery Time Objective

Based on this drill, the estimated recovery time is:

- **Backup:** ~1 minute (depends on data size)
- **Create new project:** ~2 minutes
- **Restore:** ~1 minute
- **Deploy app to new project:** ~5 minutes (update env vars on Vercel)
- **Total RTO:** ~10 minutes for database, ~15 minutes for full app

## What Is NOT Backed Up

- **Auth users** — Supabase Auth is separate. Users would need to re-register or be restored via Supabase Auth admin API.
- **Storage files** — Only bucket metadata. Actual files need separate backup if critical.
- **Edge functions** — Code is in the repo. Redeploy with `npx supabase functions deploy`.
- **n8n workflows** — Stored in n8n, not in Supabase. Back up via n8n export.
