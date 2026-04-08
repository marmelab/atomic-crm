#!/usr/bin/env bash
#
# backup.sh — Dump Hatch CRM database via Supabase CLI
#
# Usage:
#   ./scripts/backup.sh                     # Dumps to backups/hatch-crm-YYYY-MM-DD.sql
#   ./scripts/backup.sh my-backup-name      # Dumps to backups/my-backup-name.sql
#
# Prerequisites:
#   - Supabase CLI installed (npx supabase)
#   - Database password set in SUPABASE_DB_PASSWORD env var or .env file
#   - pg_dump available on PATH (comes with PostgreSQL client tools)

set -euo pipefail

PROJECT_REF="sstvgrbzecdhysdgoall"
BACKUP_DIR="$(dirname "$0")/../backups"
BACKUP_NAME="${1:-hatch-crm-$(date +%Y-%m-%d)}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"

# Load password from .env if not already set
if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    ENV_FILE="$(dirname "$0")/../.env"
    if [[ -f "$ENV_FILE" ]] && grep -q SUPABASE_DB_PASSWORD "$ENV_FILE"; then
        SUPABASE_DB_PASSWORD=$(grep SUPABASE_DB_PASSWORD "$ENV_FILE" | cut -d'=' -f2-)
        export SUPABASE_DB_PASSWORD
    else
        echo "Error: SUPABASE_DB_PASSWORD not set."
        echo "Set it via: export SUPABASE_DB_PASSWORD='your-password'"
        echo "Or add SUPABASE_DB_PASSWORD=your-password to .env"
        exit 1
    fi
fi

# Create backup directory
mkdir -p "$BACKUP_DIR"

echo "Starting backup of Hatch CRM database..."
echo "Project: ${PROJECT_REF}"
echo "Output:  ${BACKUP_FILE}"

# Use direct connection (port 5432) for pg_dump — pooler doesn't support it
PGPASSWORD="$SUPABASE_DB_PASSWORD" pg_dump \
    --host "db.${PROJECT_REF}.supabase.co" \
    --port 5432 \
    --username postgres \
    --dbname postgres \
    --format plain \
    --no-owner \
    --no-privileges \
    --schema public \
    --file "$BACKUP_FILE"

if [[ $? -eq 0 ]]; then
    FILE_SIZE=$(du -h "$BACKUP_FILE" | cut -f1)
    echo "Backup complete: ${BACKUP_FILE} (${FILE_SIZE})"
    echo ""
    echo "To restore to a scratch project:"
    echo "  PGPASSWORD='password' psql -h db.<ref>.supabase.co -p 5432 -U postgres -d postgres -f ${BACKUP_FILE}"
else
    echo "Backup failed. Check your database password and network connectivity."
    exit 1
fi
