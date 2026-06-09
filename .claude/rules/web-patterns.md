---
paths:
  - "**/*.tsx"
  - "**/*.ts"
---

# Web Patterns

## State management

Treat these concerns separately — do not mix them:

Server state    → TanStack Query, SWR, or tRPC
Client state    → Zustand, Jotai, or signals
URL state       → search params, route segments
Form state      → React Hook Form or equivalent

Do not duplicate server state into client stores.
Derive values instead of storing redundant computed state.

## URL as state

Persist shareable state in the URL: filters, sort order, pagination,
active tab, search query. If refreshing the page should restore the
state, it belongs in the URL.

## Component composition

Container components own data loading and side effects.
Presentational components receive props and render UI — keep them pure.

Use compound components when related UI shares state and interaction
semantics (parent owns state, children consume via context).
Prefer this over prop drilling for complex widgets.

## Data fetching

Fetch independent data in parallel — avoid parent-child request waterfalls.

For optimistic updates:
1. Snapshot current state
2. Apply optimistic update immediately
3. Roll back on failure
4. Emit visible error feedback when rolling back

Prefer stale-while-revalidate: return cached data immediately,
revalidate in the background. Use existing libraries rather than
rolling this by hand.

## API response format

Use a consistent envelope for all API responses:

    interface ApiResponse<T> {
      success: boolean
      data?: T
      error?: string
      meta?: {
        total: number
        page: number
        limit: number
      }
    }