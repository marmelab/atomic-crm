#!/usr/bin/env bash
# Launch @playwright/mcp against the repo's BUNDLED Chromium (the one
# `make install-playwright-browsers` provisions and the Playwright e2e suite already
# uses), instead of the MCP's default `chrome` channel (/opt/google/chrome/chrome),
# which provisioning never installs. Without this the feature-smoke reviewer's first
# navigate fails with "Chromium distribution 'chrome' is not found" and only works if
# someone symlinks the bundled binary by hand.
#
# The bundled path is version-pinned (chromium-<rev>), so resolve it dynamically via
# playwright-core rather than hardcoding it in .mcp.json. If resolution fails (e.g.
# playwright-core absent), fall back to the MCP default so behavior is no worse than before.
set -euo pipefail

REPO="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$REPO"

EXE="$(node -e "console.log(require('playwright-core').chromium.executablePath())" 2>/dev/null || true)"

ARGS=(node_modules/@playwright/mcp/cli.js --headless --isolated)
if [ -n "$EXE" ] && [ -f "$EXE" ]; then
  ARGS+=(--executable-path "$EXE")
fi

exec node "${ARGS[@]}" "$@"
