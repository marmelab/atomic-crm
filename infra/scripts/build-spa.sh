#!/usr/bin/env bash
# Production Vite build for crm.dev.ardley.us.
set -euo pipefail
ROOT="$(cd "$(dirname "$0")/../.." && pwd)"
cd "$ROOT"
export VITE_CRM_API_URL="${VITE_CRM_API_URL:-https://api.crm.dev.ardley.us}"
export VITE_COGNITO_USER_POOL_ID="${VITE_COGNITO_USER_POOL_ID:-us-east-1_m3IX8Cc9L}"
export VITE_COGNITO_CLIENT_ID="${VITE_COGNITO_CLIENT_ID:-5iev0urdr2eadqd5vuo66ou4nc}"
export VITE_COGNITO_DOMAIN="${VITE_COGNITO_DOMAIN:-https://ardley-app-users-dev.auth.us-east-1.amazoncognito.com}"
export VITE_APP_BASE="${VITE_APP_BASE:-/}"
# CloudFront + hashed assets; a SW precache kept serving the previous
# bundle after deploy and looped logout.
export VITE_DISABLE_PWA="${VITE_DISABLE_PWA:-true}"
npm run build
