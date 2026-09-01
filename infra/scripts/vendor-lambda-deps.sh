#!/usr/bin/env bash
# Copy already-installed `pg` from the repo root into Lambda assets.
# Avoids a new-package install (denied) and Docker bundling (npm cache in image).
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
PKGS=(
  pg pg-cloudflare pg-connection-string pg-int8 pg-pool pg-protocol pg-types
  pgpass postgres-array postgres-bytea postgres-date postgres-interval split2 xtend
)
for dest in infra/lambda/bff infra/lambda/seed; do
  mkdir -p "$ROOT/$dest/node_modules"
  for pkg in "${PKGS[@]}"; do
    rm -rf "$ROOT/$dest/node_modules/$pkg"
    if [ -d "$ROOT/node_modules/$pkg" ]; then
      cp -R "$ROOT/node_modules/$pkg" "$ROOT/$dest/node_modules/$pkg"
    fi
  done
done
