---
name: update-branding
description: Rebrand Atomic CRM — change the application logo (the wordmark in the header and on the login/signup pages) and/or the title/name. Use when the user wants to change, swap, update, or rebrand the CRM logo or title. Handles the two light/dark-mode logo variants, the three places the title is hardcoded, the config that points at them, and — optionally — the browser favicon and PWA app icons.
---

# update-branding

## Overview

Changes the CRM **logo** and/or **title**. The logo shows in **two themes** across **five screens** (desktop + mobile header, login, signup, confirmation) and the title is hardcoded in **three** places a naive single-file edit leaves one stale. The steps below catch all of them. 
Exit criterion: the logo renders correctly in both themes across all five screens, and the title is consistent in the header, browser tab, and PWA name.

## When to Use

- The user wants to change, swap, or rebrand the CRM logo and/or title/name.
- Optionally, when they also ask to update the favicon or PWA app icons.

Not for theme colors or component styling see `Skill({skill: "shadcn-customization"})`.

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

## Rationalizations

| Rationalization | Reality |
|---|---|
| "I changed the logo file, that's the whole job." | The logo shows in two themes across five screens and the title lives in three files. One edit leaves a stale variant. |
| "My code change has no visual effect, so it didn't apply." | The `/settings` store shadows `defaultConfiguration.ts` per browser. Clear the `CRM.app.configuration` localStorage key. |
| "One image is fine for both themes." | The auth pages always use the dark-mode key; a single asset reads wrong on one background. Warn or derive the second variant. |
| "I'll regenerate a couple of favicon sizes." | The PWA set is 34 PNGs. Regenerate every size from one source or ask for the set don't hand-edit a few. |

## Red Flags

- Editing only one of the two logo asset keys, or swapping the light/dark files.
- Changing the title in `defaultConfiguration.ts` but not `index.html` and `manifest.json`.
- A code change with no visible effect, with the `CRM.app.configuration` store left uncleared.
- Hand-editing a subset of favicon/PWA sizes instead of regenerating the full set.
- Touching the docs-site logo (`doc/`) when it wasn't requested.

## Verification

`make typecheck` catches only config-key typos. Then `make start` and check: header in **both themes**, **desktop + mobile**; the **login/signup** pages (dark bg); and if the title changed, the header `<h1>`, browser tab, and PWA name. A logo wrong in exactly one theme means both keys point at one asset, or the light/dark files are swapped.

- [ ] Both logo variants point at the correct light/dark assets (named by display mode, not color).
- [ ] Logo renders in both themes, desktop + mobile, and on login/signup/confirmation.
- [ ] If the name changed, the title is updated in `defaultConfiguration.ts`, `index.html`, and `manifest.json`.
- [ ] If no visual effect appears, the `CRM.app.configuration` localStorage key was cleared.
- [ ] Favicon/PWA icons regenerated as a full set only if explicitly requested.

## Favicon & app icons (optional)

Only if asked. Referenced by `index.html` + `public/manifest.json`: `public/favicon.ico` and `public/appIcon/*.png` (34 sizes incl. `maskable_icon*`). Regenerate **every** size from one square source (`sharp` / `pwa-asset-generator`) or ask the user for the set — don't hand-edit a few. Confirm scope first; `theme_color`/`background_color` in `manifest.json` may also need updating.

> The docs-site logo (`doc/astro.config.mjs` → `doc/public/logo_atomic_crm_*.svg`) is a separate Astro site — leave it unless asked.
