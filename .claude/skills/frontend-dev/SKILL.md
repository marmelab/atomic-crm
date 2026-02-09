---
name: frontend-dev
description: Coding practices for frontend development in Atomic CRM. Use when creating or modifying React components, forms, list pages, detail views, filters, data fetching, or responsive layouts.
---

The frontend uses ra-core (react-admin headless) for data fetching, routing, and CRUD logic, with shadcn-admin-kit and shadcn/ui for the UI layer.

## Component architecture

- Import form inputs (`TextInput`, `SelectInput`, `ReferenceInput`, etc.) from `@/components/admin/`, not from shadcn/ui directly. The admin layer wraps shadcn with ra-core integration (labels, validation, data binding).
- Import pure UI components (`Card`, `Button`, `Badge`, `Sheet`, etc.) from `@/components/ui/`.
- Domain configuration (deal stages, note statuses, task types, company sectors) comes from `useConfigurationContext()`, never hardcoded.

## Resource (CRUD) conventions

Each resource follows this file structure (e.g. `contacts/`):

- `ContactList.tsx` — list page (desktop + mobile variants)
- `ContactShow.tsx` — detail view
- `ContactEdit.tsx` / `ContactCreate.tsx` — form pages
- `ContactInputs.tsx` — shared form fields reused between create and edit
- `index.tsx` — exports `{ list, show, edit, create, recordRepresentation }`

Resources are registered in `root/CRM.tsx` via `<Resource name="contacts" {...contacts} />`.

## Data fetching

- For standard CRUD, use ra-core hooks: `useListContext()`, `useShowContext()`, `useGetList()`, `useGetOne()`, `useGetIdentity()`.
- When a query or mutation isn't covered by ra-core hooks, add a custom dataProvider method and call it via `useQuery`/`useMutation` with `useDataProvider<CrmDataProvider>()` (e.g. `dataProvider.getActivityLog()` in `ActivityLog.tsx`, `dataProvider.salesCreate()` in `SalesCreate.tsx`).

## Forms

- Forms use `Form` from ra-core + `FormToolbar` for submit/cancel actions.
- Ra-core's `Form` uses React Hook Form under the hood. Use `useFormContext()` for imperative operations (`setValue`, `reset`, `getValues`).
- Top-level resource forms use full-page `CreateBase`/`EditBase` with `Card` (e.g. contacts), or `Dialog` (e.g. deals).
- On mobile, inline/sub-resource forms use `CreateSheet`/`EditSheet` from `misc/` (e.g. notes, tasks).
- Split form fields into semantic sub-components (e.g. `ContactIdentityInputs`, `ContactPositionInputs`).

## Filters

- Use `ToggleFilterButton` / `ActiveFilterButton` components for filter UI.
- Filters apply immediately, no "apply" button.

## Responsive design

- Major pages have desktop and mobile variants. Use `useIsMobile()` to branch.
- Desktop: 2-column grid layouts. Mobile: single column with `MobileHeader`/`MobileContent`.
- Mobile lists use `InfiniteListBase` for scroll pagination.
