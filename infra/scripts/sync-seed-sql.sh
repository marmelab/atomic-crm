#!/usr/bin/env bash
# Copy the schema + seed SQL the seed Lambda ships into its asset folder.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
DEST="$ROOT/infra/lambda/seed/sql"
mkdir -p "$DEST"
cp "$ROOT/docs/schema-direction.sql" "$DEST/schema-direction.sql"
cp "$ROOT/sql/seed_w0.sql" "$DEST/seed_w0.sql"
cp "$ROOT/sql/seed_w1.sql" "$DEST/seed_w1.sql"
cp "$ROOT/sql/seed_w3.sql" "$DEST/seed_w3.sql"
cp "$ROOT/sql/seed_w3_roster.sql" "$DEST/seed_w3_roster.sql"
