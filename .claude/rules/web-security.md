---
paths:
  - "**/*.tsx"
  - "**/*.ts"
  - "**/*.html"
---

# Web Security

## Required HTTP headers

Every production response must include:

    Strict-Transport-Security: max-age=31536000; includeSubDomains; preload
    X-Content-Type-Options: nosniff
    X-Frame-Options: DENY
    Referrer-Policy: strict-origin-when-cross-origin
    Permissions-Policy: camera=(), microphone=(), geolocation=()

## XSS prevention

Never inject unsanitized HTML.
Avoid innerHTML and dangerouslySetInnerHTML unless sanitized first.
Escape all dynamic template values.
When user-generated HTML is absolutely required, sanitize with a
vetted local sanitizer — never trust raw user input.

## Content Security Policy

Configure a production CSP. Use a per-request nonce for scripts
instead of unsafe-inline.

    Content-Security-Policy:
      default-src 'self';
      script-src 'self' 'nonce-{RANDOM}';
      style-src 'self' 'unsafe-inline';
      img-src 'self' data: https:;
      connect-src 'self';
      frame-src 'none';
      object-src 'none';
      base-uri 'self';

Adjust origins to the actual project. Do not copy this block unchanged.

## Third-party scripts

Load asynchronously. Use SRI (Subresource Integrity) when serving
from a CDN. Audit third-party dependencies quarterly. Prefer
self-hosting for critical dependencies when practical.

## Forms

CSRF protection on all state-changing forms.
Rate limiting on all submission endpoints.
Validate both client-side and server-side — never rely on one alone.