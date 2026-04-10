# Wave 1 UI Audit Report

## Scope

Audited files:

- `src/index.css`
- `src/components/atomic-crm/layout/Layout.tsx`
- `src/components/atomic-crm/layout/Header.tsx`
- `src/components/admin/app-sidebar.tsx`

Reference-only context used:

- `src/components/admin/layout.tsx`
- `src/components/ui/sidebar.tsx`
- `src/components/atomic-crm/root/CRM.tsx`
- `src/components/atomic-crm/root/ConfigurationContext.tsx`
- `src/components/atomic-crm/root/useConfigurationLoader.ts`
- `src/components/atomic-crm/root/defaultConfiguration.ts`

## Summary

| Severity | Count |
| --- | ---: |
| P0 | 0 |
| P1 | 2 |
| P2 | 4 |
| P3 | 3 |

Compiler and lint status for the scoped TSX files:

- `npm run typecheck`: passed
- `npx eslint src/components/atomic-crm/layout/Layout.tsx src/components/atomic-crm/layout/Header.tsx src/components/admin/app-sidebar.tsx`: passed
- `npx prettier --check src/index.css src/components/atomic-crm/layout/Layout.tsx src/components/atomic-crm/layout/Header.tsx src/components/admin/app-sidebar.tsx`: failed on all 4 scoped files

No broken imports, TypeScript errors, or React hook rule violations were confirmed in the scoped files.

## Detailed Findings

### `src/index.css`

#### P1: Primary theme tokens fail accessible contrast in multiple core components

- Lines: `54-55`, `73-76`, `98-99`, `117-120`
- Issue: `--primary` / `--primary-foreground` and `--sidebar-primary` / `--sidebar-primary-foreground` pair light text with `#4AC1E0`. That color combination is too low-contrast for normal text. Measured ratios are about `2.10:1` with `#FFFFFF` and `1.93:1` with `#F5F5F4`.
- Why it matters: This affects default buttons, tooltips, badges, checkbox checked state, and the sidebar avatar fallback initials. Text and iconography on primary surfaces will fail WCAG AA and become hard to read.
- Suggested fix approach: Darken the primary color substantially, or switch primary foreground text to a dark color on light cyan surfaces. Re-check the final token pairs against WCAG before shipping.

#### P2: Mobile zoom workaround globally inflates all `rem` sizing on screens up to 768px

- Lines: `145-153`
- Issue: The mobile zoom mitigation sets `html { font-size: 17px; }` for the whole app, not just form controls.
- Why it matters: Every `rem`-based token and layout dimension scales up on mobile, including spacing, headers, sheets, and sidebars. That creates broad responsive drift and makes the UI harder to reason about across breakpoints.
- Suggested fix approach: Keep the root font size unchanged and apply the `16px` safeguard only to interactive form controls that trigger iOS zoom (`input`, `textarea`, `select`).

### `src/components/atomic-crm/layout/Layout.tsx`

#### P3: Error boundary no longer captures `errorInfo`, reducing debuggability

- Lines: `19-25`
- Issue: The layout uses `FallbackComponent={Error}` directly, unlike the pattern reference in `src/components/admin/layout.tsx`, which captures `ErrorInfo` via `onError` and passes it through `fallbackRender`.
- Why it matters: In development, the shared `Error` component can show `errorInfo.componentStack`, but this layout never provides it. That removes the component stack from crash output and slows down debugging.
- Suggested fix approach: Restore the reference pattern with local `errorInfo` state, `onError`, and `fallbackRender` so the fallback receives both the thrown error and the component stack.

### `src/components/atomic-crm/layout/Header.tsx`

#### P1: Breadcrumb portal target was removed, so CRUD breadcrumbs silently disappear

- Lines: `14-29`
- Issue: The header replaced the reference layout's `<div id="breadcrumb" />` slot with a plain spacer (`<div className="flex-1" />`).
- Why it matters: `src/components/admin/breadcrumb.tsx` renders into `document.getElementById("breadcrumb")` and returns `null` when that node is missing. As a result, list/edit/show pages lose breadcrumb navigation across the desktop layout.
- Suggested fix approach: Restore the breadcrumb host element, ideally matching the reference layout structure (`<div className="flex-1 flex items-center" id="breadcrumb" />`).

#### P3: Desktop header removed the built-in locale switcher despite the app shipping multiple locales

- Lines: `17-28`
- Issue: The custom header omits `LocalesMenuButton`, while the reference layout includes it and the i18n provider exposes both `en` and `fr`.
- Why it matters: Desktop users lose the global in-header language switch and must discover alternate locale controls elsewhere. This is a functional regression from the reference layout.
- Suggested fix approach: Re-introduce `LocalesMenuButton` in the header, or replace it with another equally discoverable global locale control.

### `src/components/admin/app-sidebar.tsx`

#### P2: The desktop sidebar drops the `tasks` resource from navigation

- Lines: `64-123`
- Issue: The sidebar exposes dashboard, deals, contacts, companies, sales, integration log, and settings, but there is no `/tasks` item even though `src/components/atomic-crm/root/CRM.tsx` registers `Resource name="tasks"` for the desktop admin.
- Why it matters: A top-level feature is still mounted in the app but no longer reachable from primary desktop navigation, which is a concrete route/navigation mismatch and a major discoverability regression.
- Suggested fix approach: Add a `Tasks` entry to the desktop sidebar, or intentionally remove the desktop resource if the feature is no longer meant to be navigated directly.

#### P2: Integration Log is shown to users who are explicitly denied access

- Lines: `108-113`
- Issue: The `Integration Log` nav item is always rendered, but `src/components/atomic-crm/providers/commons/canAccess.ts` denies non-admin access to `integration_log`.
- Why it matters: Non-admin users are shown an admin-only destination they cannot use, which creates a broken navigation path and leaks administrative surface area into the standard UI.
- Suggested fix approach: Gate the nav item with `CanAccess resource="integration_log" action="list"` or build the sidebar from a permission-aware menu config.

#### P2: Sidebar branding and labels are hardcoded instead of using configuration and translations

- Lines: `30`, `51-58`, `68-118`, `138-139`
- Issue: The sidebar always uses `darkModeLogo`, hardcodes `Hatch CRM`, and hardcodes English labels such as `Dashboard`, `Administration`, and `Signed in`.
- Why it matters: Desktop branding ignores `title` and `lightModeLogo` from configuration, so light theme can show the wrong asset and custom app titles never appear. The hardcoded English strings also bypass the app's `en`/`fr` translation system.
- Suggested fix approach: Read `title`, `lightModeLogo`, and `darkModeLogo` from configuration and render the correct logo per theme. Replace literal labels with `useTranslate()` keys so the sidebar stays aligned with the rest of the app.

#### P3: Active sidebar links are only visually indicated, not exposed to assistive tech

- Lines: `163-169`
- Issue: `NavMenuItem` computes active state with `useMatch`, but it only passes `isActive` for styling and never sets `aria-current="page"` on the active link.
- Why it matters: Screen reader users do not get a programmatic "current page" announcement from the primary navigation, even though sighted users see an active state.
- Suggested fix approach: Set `aria-current={match ? "page" : undefined}` on the rendered `Link` when the route matches.
