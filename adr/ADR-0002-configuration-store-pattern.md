# ADR-0002 — App configuration via ra-core store, not React Context

- **Date**: 2026-06-18
- **Status**: Accepted (documents an existing, deliberate decision)
- **Basis**: graphify analysis of `src/` (`useConfigurationContext()` is a 59-edge import hub)

## Context

App-wide config (deal stages, note statuses, task types, branding, auth flags) must be
readable by ~59 components at every altitude, editable from Settings, and seeded from
both `<CRM>` props and a remote `dataProvider.getConfiguration()` call. Prop drilling and
a deep Context provider tree were both unattractive at that fan-out.

## Decision

Back configuration with **ra-core's `useStore`** keyed on `CONFIGURATION_STORE_KEY`
(`ConfigurationContext.tsx`) — despite the "Context" filename, there is **no
`createContext`/`Provider`**. Three hooks: `useConfigurationContext()` (read, merges
`{...defaults, ...stored}`), `useConfigurationUpdater()` (write), `useConfigurationLoader()`
(bootstrap via TanStack Query, called by both `Layout` and `MobileLayout`).

## Consequences

- Any component reads config with one hook — no provider nesting, reactive updates, localStorage persistence.
- Merge-with-defaults makes new config fields forward-compatible: old stored configs never break.
- High blast radius: the `ConfigurationContextValue` type is the contract between `dataProvider.getConfiguration()` and all 59 consumers — changing it ripples both ways.
- Naming hazard: contributors will look for a `<ConfigurationProvider>` that does not exist. Keep this ADR linked from the file.

## Alternatives considered

- **React Context + Provider** — rejected: deep provider, no persistence, re-render scoping awkward at 59 consumers.
- **Prop drilling from `<CRM>`** — rejected: unmanageable fan-out, no runtime updates from Settings.
- **TanStack Query as the source of truth (no store)** — rejected: config is also seeded from props/localStorage before any fetch; the store unifies all three sources.
