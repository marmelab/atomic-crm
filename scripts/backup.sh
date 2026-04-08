#!/usr/bin/env bash
#
# backup.sh - Dump Hatch CRM database via pg_dump
#
# Usage:
#   ./scripts/backup.sh                     # Dumps to backups/hatch-crm-YYYY-MM-DD.sql
#   ./scripts/backup.sh my-backup-name      # Dumps to backups/my-backup-name.sql
#   ./scripts/backup.sh my-backup-name ref  # Dumps using the provided project ref
#
# Prerequisites:
#   - PostgreSQL client tools installed (`pg_dump`)
#   - Database password set in SUPABASE_DB_PASSWORD env var or .env file
#   - Project ref set in SUPABASE_PROJECT_REF, passed as the second arg, or derivable from VITE_SUPABASE_URL

set -euo pipefail

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
ENV_FILE="${SCRIPT_DIR}/../.env"
BACKUP_DIR="${SCRIPT_DIR}/../backups"
BACKUP_NAME="${1:-hatch-crm-$(date +%Y-%m-%d)}"
PROJECT_REF="${SUPABASE_PROJECT_REF:-${2:-}}"
BACKUP_FILE="${BACKUP_DIR}/${BACKUP_NAME}.sql"

get_env_value() {
    local key="$1"

    if [[ -n "${!key:-}" ]]; then
        printf '%s' "${!key}"
        return 0
    fi

    if [[ -f "$ENV_FILE" ]]; then
        local value
        value="$(grep -m1 "^${key}=" "$ENV_FILE" | cut -d'=' -f2- | tr -d '\r' || true)"
        value="${value%\"}"
        value="${value#\"}"
        value="${value%\'}"
        value="${value#\'}"

        if [[ -n "$value" ]]; then
            printf '%s' "$value"
            return 0
        fi
    fi

    return 1
}

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    SUPABASE_DB_PASSWORD="$(get_env_value SUPABASE_DB_PASSWORD || true)"
fi

if [[ -z "${SUPABASE_DB_PASSWORD:-}" ]]; then
    echo "Error: SUPABASE_DB_PASSWORD not set."
    echo "Set it via: export SUPABASE_DB_PASSWORD='your-password'"
    echo "Or add SUPABASE_DB_PASSWORD=your-password to .env"
    exit 1
fi

if [[ -z "$PROJECT_REF" ]]; then
    SUPABASE_URL="$(get_env_value VITE_SUPABASE_URL || true)"
    if [[ "$SUPABASE_URL" =~ ^https?://([^.]+)\.supabase\.co/?$ ]]; then
        PROJECT_REF="${BASH_REMATCH[1]}"
    fi
fi

if [[ -z "$PROJECT_REF" ]]; then
    echo "Error: project ref not set."
    echo "Pass it as the second argument, set SUPABASE_PROJECT_REF, or set VITE_SUPABASE_URL in .env."
    exit 1
fi

mkdir -p "$BACKUP_DIR"

trap 'echo "Backup failed. Check your database password, project ref, and network connectivity."; exit 1' ERR

echo "Starting backup of Hatch CRM database..."
echo "Project: ${PROJECT_REF}"
echo "Output:  ${BACKUP_FILE}"

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

FILE_SIZE="$(du -h "$BACKUP_FILE" | cut -f1)"
echo "Backup complete: ${BACKUP_FILE} (${FILE_SIZE})"
echo ""
echo "To restore to a scratch project:"
echo "  PGPASSWORD='password' psql -h db.<ref>.supabase.co -p 5432 -U postgres -d postgres -f ${BACKUP_FILE}"
