---
name: update-branding
description: Rebrand Atomic CRM — change the application logo (the wordmark in the header and on the login/signup pages) and/or the title/name. Use when the user wants to change, swap, update, or rebrand the CRM logo or title. Handles the two light/dark-mode logo variants, the three places the title is hardcoded, the config that points at them, and — optionally — the browser favicon and PWA app icons.
---

# update-branding

Changes the CRM **logo** and/or **title**. The logo appears in **two themes** and on **four screens**, and the title is hardcoded in **three** independent places — so a naive single-file replacement usually leaves one of them stale, which is why this normally takes several prompts. Follow the steps below to get it right in one pass.

## What "the logo" actually is

There are **two separate asset families**. Confirm with the user which they mean — most "change the logo" requests mean only the first.

1. **The app logo / wordmark** (the common case) — `public/logos/`:
   - `logo_atomic_crm_dark.svg` — **light-colored** art (white fill), shown when the app is in **dark mode** and on every auth page.
   - `logo_atomic_crm_light.svg` — **dark-colored** art (black fill), shown when the app is in **light mode**.
   - `logo_atomic_crm.svg` — a standalone copy (identical to the dark one); not wired to anything in the app, safe to update for consistency or ignore.

   > Naming is by **the mode it displays in**, not the art's color. The "dark-mode" logo must read on a dark background (so it's light), and vice-versa.

2. **The favicon + PWA icons** (only if the user asks for the browser-tab / installed-app icon) — see [Favicon & app icons](#favicon--app-icons-optional). This is a much bigger job (34 sized PNGs) and is **out of scope unless explicitly requested**.

## Two ways to change the logo/title — pick the right one

There are **two independent mechanisms**, and confusing them is the #1 source of "I changed it but nothing happened":

1. **Code-level defaults (what this skill does).** Edits `defaultConfiguration.ts` + the asset files. **Committed to the repo, applies to every user and deployment**, and is the only way to also change the browser-tab title / favicon / PWA icons.
2. **Runtime Settings UI.** The in-app **`/settings` page → "Branding" section** ([`settings/SettingsPage.tsx`](../../../src/components/atomic-crm/settings/SettingsPage.tsx)) lets a logged-in user edit the `title` and upload light/dark logos with **no code change**. But this is **per-browser**: it's saved in `localStorage` under `CRM.app.configuration` (uploaded logos are stored as base64, *not* written to `public/logos/`), never committed, and covers **only** the in-app header/auth logo + header title — not the browser-tab title, favicon, or PWA manifest.

> ⚠️ **The store shadows the code.** `useConfigurationContext` returns `{ ...defaultConfiguration, ...storedConfig }` ([`ConfigurationContext.tsx`](../../../src/components/atomic-crm/root/ConfigurationContext.tsx)). So if branding was **ever** saved via `/settings`, the stored value wins and your edits to `defaultConfiguration.ts` won't show in that browser. To make code defaults take effect again, clear the `CRM.app.configuration` key from `localStorage` (or re-save matching values in `/settings`). Suspect this whenever a code change appears to have no visual effect.

Use the code path (this skill) for a permanent, shipped rebrand; point the user to `/settings` for a quick per-user tweak.

## Where the app logo is wired

- **Config (source of truth for defaults):** `src/components/atomic-crm/root/defaultConfiguration.ts`
  ```ts
  export const defaultDarkModeLogo = "./logos/logo_atomic_crm_dark.svg";
  export const defaultLightModeLogo = "./logos/logo_atomic_crm_light.svg";
  ```
  These can also be overridden per-deployment via `<CRM darkModeLogo=… lightModeLogo=… />` in `src/App.tsx` (currently `<CRM />`, so the defaults apply). At runtime, a saved Settings value overrides all of these (see above).
- **Consumers** (no edits needed if you keep the config keys; listed so you can verify):
  - `layout/Header.tsx` — renders **both**, toggled by CSS (`[.light_&]:hidden` / `[.dark_&]:hidden`), height `h-6`. Any aspect ratio works.
  - `login/LoginPage.tsx`, `login/SignupPage.tsx`, `login/ConfirmationRequired.tsx` — render **only `darkModeLogo`** (dark backgrounds). A logo that only reads on a light background will be invisible here.

## Steps

1. **Gather the asset(s).** Ask the user for the new logo file path or URL, and whether they have **separate light/dark variants** or a single image. Note the format (SVG vs PNG).
   - One variant only → set both config keys to it, and **warn** it may have poor contrast in one theme (especially the auth pages, which always use the dark-mode key).
   - SVG with a single solid fill → you can derive the other variant by swapping the fill color (e.g. `white` ↔ `black`); confirm the result reads in both themes.
2. **Place the files** in `public/logos/`. Pick one approach:
   - **Drop-in (simplest, no code change):** overwrite `logo_atomic_crm_dark.svg` / `logo_atomic_crm_light.svg`, keeping the **exact filenames and `.svg` extension**. Only valid if the new asset is also SVG. The config already points here, so you're done after this.
   - **New name or different format (e.g. PNG):** save as new files (e.g. `logo_company_dark.png`), then update the two consts in `defaultConfiguration.ts` to match (paths are relative to `public/`, so `"./logos/<file>"`).
3. **Update the title**, if the brand name is changing too. It lives in **three independent places** — `defaultTitle` drives only the in-app one, so the other two stay stale unless edited by hand:
   - `defaultConfiguration.ts` → `defaultTitle` — the header `<h1>` and the logo `alt` text (also overridable via `<CRM title=… />`).
   - `index.html` → `<title>…</title>` — the **browser-tab** title. Hardcoded; no `document.title` is set at runtime, so it does **not** follow `defaultTitle`.
   - `public/manifest.json` → `short_name` and `name` — the **installed-PWA** name.
4. **Verify** (below).

## Favicon & app icons (optional)

Only if the user asks to change the browser-tab / installed-app icon. These are **not** SVGs and are referenced by `index.html` and `public/manifest.json`:
- `public/favicon.ico`
- `public/appIcon/*.png` — 34 files across many sizes, including `maskable_icon*` variants.

Doing this properly means regenerating **every** size from one square source (use a tool like `sharp`/`pwa-asset-generator`, or ask the user to provide the set). Don't hand-edit a few and leave the rest mismatched — **flag the full list to the user** and confirm scope before starting. The `theme_color`/`background_color` in `manifest.json` may also need updating to match the new brand.

> The documentation site logo (`doc/astro.config.mjs` → `doc/public/logo_atomic_crm_*.svg`) is a **separate** Astro site, not the app. Leave it unless the user explicitly asks to rebrand the docs.

## Verify

```bash
make typecheck   # only catches config-key typos; the rest is visual
```

Then run the app (`make start`) and check **all four** surfaces, since the two themes use different files:
- Header in **light mode** and in **dark mode** (toggle the theme) — correct logo, legible, not stretched.
- The **login page** (and signup/confirmation) — uses the dark-mode logo on a dark background.
- If the title changed: the **header `<h1>`**, the **browser-tab** title (`index.html`), and the **PWA name** (`manifest.json`) all read the new brand.

If the logo looks wrong in exactly one theme, you likely set both config keys to the same single-color asset, or swapped the light/dark files.
