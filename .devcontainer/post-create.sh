#!/usr/bin/env bash
set -euo pipefail

claude plugin marketplace add anthropics/claude-plugins-official
claude plugin marketplace update claude-plugins-official
claude plugin install typescript-lsp

sudo npm install -g supabase typescript-language-server

# Install Playwright browsers using the REPO's pinned playwright version (resolved
# from node_modules after the ./npm feature ran `npm install`), so the downloaded
# browser revision always matches what package.json/package-lock.json expect.
# Doing it here — instead of the playwright feature's floating `npx playwright
# install` — is what keeps the repo the single source of truth for the version and
# avoids the "browser revision X installed but the repo wants Y" mismatch.
npx playwright install chromium chromium-headless-shell
