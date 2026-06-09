---
name: update-branding
description: Rebrand Atomic CRM — change the application logo (the wordmark in the header and on the login/signup pages) and/or the title/name. Use when the user wants to change, swap, update, or rebrand the CRM logo or title. Handles the two light/dark-mode logo variants, the three places the title is hardcoded, the config that points at them, and — optionally — the browser favicon and PWA app icons.
---

# update-branding

Changes the CRM **logo** and/or **title**. The logo shows in **two themes** across **five screens** (desktop + mobile header, login, signup, confirmation) and the title is hardcoded in **three** places — a naive single-file edit leaves one stale. The steps below catch all of them.

## Logo: two asset families

Confirm which the user means — most requests mean only #1.

1. **App logo / wordmark** (common) — `public/logos/`. `logo_atomic_crm_dark.svg` is **light-colored** art shown in **dark mode** + all auth pages; `logo_atomic_crm_light.svg` is **dark-colored** art shown in **light mode**. (`logo_atomic_crm.svg` is an unused standalone copy.)
   > Files are named by **the mode they display in**, not their color — the "dark-mode" logo must read on a dark background.
2. **Favicon + PWA icons** — only if asked. Much bigger (34 PNGs); see [below](#favicon--app-icons-optional).

## Code defaults vs. runtime Settings — they conflict

- **Code defaults (this skill):** edit `defaultConfiguration.ts` + assets. Committed, applies everywhere, and the only way to change the browser-tab title / favicon / PWA icons.
- **Settings UI** (`/settings` → Branding, [`SettingsPage.tsx`](../../../src/components/atomic-crm/settings/SettingsPage.tsx)): a logged-in user edits title + uploads logos, **per-browser**, saved to `localStorage` as `CRM.app.configuration` (logos as base64), never committed. Covers only the in-app logo + header title.

> ⚠️ **The store shadows the code.** `useConfigurationContext` returns `{ ...defaultConfiguration, ...storedConfig }` ([`ConfigurationContext.tsx`](../../../src/components/atomic-crm/root/ConfigurationContext.tsx)). If branding was ever saved via `/settings`, your edits to `defaultConfiguration.ts` won't show in that browser — clear the `CRM.app.configuration` localStorage key. Suspect this whenever a code change has no visual effect.

## Steps

1. **Gather the asset(s).** Ask for the file/URL, format (SVG vs PNG), and whether there are **separate light/dark variants** or one image.
   - One variant → set both config keys to it; **warn** about poor contrast in one theme (auth pages always use the dark-mode key).
   - Single-fill SVG → derive the other variant by swapping the fill (`white` ↔ `black`).
2. **Place the files** in `public/logos/`:
   - **Drop-in (simplest):** overwrite `logo_atomic_crm_dark.svg` / `logo_atomic_crm_light.svg`, keeping the exact filenames + `.svg`. Config already points here — done. (SVG only.)
   - **New name / format (e.g. PNG):** save as new files, then update the two consts in `defaultConfiguration.ts` (`defaultDarkModeLogo`, `defaultLightModeLogo`; paths relative to `public/`, so `"./logos/<file>"`).
3. **Update the title** (if the name changes) in all **three** places — `defaultTitle` drives only the first:
   - `defaultConfiguration.ts` → `defaultTitle` — header `<h1>` + logo `alt`.
   - `index.html` → `<title>` — browser-tab title (hardcoded, not set at runtime).
   - `public/manifest.json` → `short_name` + `name` — installed-PWA name.

Consumers (no edits if you keep the config keys): `layout/Header.tsx` + `dashboard/MobileDashboard.tsx` render both variants (CSS-toggled, `h-6`); `login/{LoginPage,SignupPage,ConfirmationRequired}.tsx` render **only** `darkModeLogo`.

## Verify

`make typecheck` catches only config-key typos. Then `make start` and check: header in **both themes**, **desktop + mobile**; the **login/signup** pages (dark bg); and if the title changed, the header `<h1>`, browser tab, and PWA name. A logo wrong in exactly one theme means both keys point at one asset, or the light/dark files are swapped.

## Favicon & app icons (optional)

Only if asked. Referenced by `index.html` + `public/manifest.json`: `public/favicon.ico` and `public/appIcon/*.png` (34 sizes incl. `maskable_icon*`). Regenerate **every** size from one square source (`sharp` / `pwa-asset-generator`) or ask the user for the set — don't hand-edit a few. Confirm scope first; `theme_color`/`background_color` in `manifest.json` may also need updating.

> The docs-site logo (`doc/astro.config.mjs` → `doc/public/logo_atomic_crm_*.svg`) is a separate Astro site — leave it unless asked.
