# ADR-0003 — Dual data provider with a Supabase-defined contract

- **Date**: 2026-06-18
- **Status**: Accepted (documents an existing, deliberate decision)
- **Basis**: graphify analysis of `src/` (`CrmDataProvider` is the shared provider contract)

## Context

The app runs against two backends: Supabase (production) and FakeRest (in-browser
demo/dev). Components and the config store (ADR-0002) must stay backend-agnostic, yet the
Supabase provider carries non-trivial custom behaviour — summary-view redirects, column
casing, file uploads, `getConfiguration()` — that the demo provider must match.

## Decision

Treat Supabase as the **canonical** implementation and infer the shared contract from it:
`CrmDataProvider = ReturnType<typeof getDataProviderWithCustomMethods>`
(`supabase/dataProvider.ts:247`). FakeRest is a **conformer** — `createDataProvider()`
wraps FakeRest with `withSupabaseFilterAdapter()` and emulates DB views in-browser to
satisfy the same type. No hand-written abstract interface.

## Consequences

- Components depend only on `CrmDataProvider`; swapping backends is invisible to them.
- Structural typing keeps the demo honest: a new Supabase custom method widens the type and the compiler flags FakeRest.
- FakeRest carries a standing burden to re-emulate Supabase semantics (filter operators, `*_summary` views, snake→camel casing); drift can surface at **runtime** in demo mode, not always at compile time — `supabaseAdapter.test.ts` guards that seam.
- Backend-specific concerns (storage uploads, view redirects, config row id=1) are centralised in the provider layer, out of components.

## Alternatives considered

- **Hand-written abstract `DataProvider` interface both implement** — rejected: duplicate maintenance, easy to let the real backend drift from the spec.
- **Supabase only, no demo provider** — rejected: loses offline demo/dev and Storybook fixtures.
- **Separate component code paths per backend** — rejected: backend choice would leak into the entire UI tree.
