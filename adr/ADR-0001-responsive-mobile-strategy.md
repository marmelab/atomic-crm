# ADR-0001 — Responsive mobile/desktop rendering strategy

- **Date**: 2026-06-18
- **Status**: Accepted (documents existing architecture; sets the default going forward)
- **Basis**: graphify analysis of `src/` (`useIsMobile()` is a 53-edge import hub)

## Context

The app branches mobile vs. desktop off a single client-side hook, `useIsMobile()`
(`src/hooks/use-mobile.ts:5`, `matchMedia` at a 768px breakpoint, desktop-first until
the effect fires). 50+ components import it, but the *decision* is made at three
different altitudes with no single rule, so there is no template to copy for a new
responsive screen.

## Decision

Adopt **root-level variant swap** as the default for whole-screen mobile layouts:
`CRM.tsx:172` reads `useIsMobile()` and selects the variant. Feature mobile screens
reuse the shared shell (`MobileContent` / `MobileHeader` / `MobileNavigation`). Reserve
**inline `if (isMobile)` branching** for small, self-contained widgets only
(e.g. `ResponsiveFilters.tsx:49`, `data-table`, `breadcrumb`).

## Consequences

- One canonical place (`CRM.tsx`) to find where screens diverge by viewport.
- The shared `MobileContent` shell stays the DRY anchor for mobile pages (8 importers).
- Migration debt: `ContactShow`/`CompanyShow`/`NoteShowPage` currently branch in-page and
  should move their swap up to the root over time.
- Naming must be normalised: chrome/screens use the `Mobile*` prefix as their own file;
  in-file variants like `ContactListMobile` (`ContactList.tsx:96`) are the exception, not the rule.

## Alternatives considered

- **Pure inline branching everywhere** — rejected: 50+ scattered `if (isMobile)` with no shell, hard to navigate.
- **CSS-only responsive (Tailwind breakpoints, no JS hook)** — rejected: mobile screens differ structurally (drawer vs. sidebar, different forms), not just by layout.
- **Total root router (every screen swapped at `CRM.tsx`)** — rejected: over-centralises small widgets that are clearer branching locally.
