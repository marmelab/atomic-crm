---
name: e2e-conventions
description: Atomic CRM's own e2e facts: the two Playwright projects and what differs between them, the notification texts, and how to open a create form. Load before writing or changing any spec under e2e/. Complements the generic aiharness:e2e-conventions skill.
---

# E2E conventions for Atomic CRM

The generic rules (when a spec is required, where it goes, CJS imports) live in
`Skill({skill: "aiharness:e2e-conventions"})`. This file holds the facts about **this**
app, so you do not have to re-derive them. Everything below is checked against
`playwright.config.ts`, `e2e/fixtures.ts` and the existing specs. Prefer it over
grepping `node_modules`.

## Every spec runs TWICE: desktop and mobile

`playwright.config.ts` declares two projects, and no spec opts out of either:

| Project | Device | Viewport |
| --- | --- | --- |
| `chromium` | Desktop Chrome | desktop |
| `Mobile Chrome` | Pixel 5 | 393 x 851 |

It also runs `workers: 1`, `fullyParallel: false` (the specs share one database), so the
suite is serial and every spec you add costs its runtime twice.

**The mobile layout is a different UI, not a narrower one.** `MobileNavigation.tsx` renders
only Dashboard, Contacts, Tasks, a single create button and settings. The list toolbar is
absent, so **there is no sort control, no bulk-selection control and no per-column header in
mobile.** An unconditional assertion on any of those passes on `chromium` and fails on
`Mobile Chrome`.

This failure does not surface where you write it: the per-ticket validation chain does not
run the suite, so a viewport-blind spec passes review, passes the merge, and only fails at
end-of-feature, where fixing it costs a whole extra developer + review + merge round.

### Handle it the way the existing specs do

Both patterns are already in the suite. Use `isMobile`, which the Playwright fixture gives
you for free:

```ts
// Whole spec is desktop-only, as in bulkContactTags.spec.ts
test.skip(isMobile, "Bulk tag is only available on desktop");

// One step differs, as in userAddingATask.spec.ts
if (isMobile) {
  await page.getByRole("button", { name: "Create" }).click();
} else {
  await page.getByRole("button", { name: "Add Task" }).click();
}
```

Never widen the viewport to make a desktop-only assertion pass: that deletes the mobile
coverage the config asked for.

## Opening a create form

The create affordance is one of the things that differs:

| | Locator |
| --- | --- |
| mobile | `getByRole("button", { name: "Create" })`, and `MobileNavigation.tsx` labels it `ra.action.create` |
| desktop | `getByRole("button", { name: <the resource's own label> })` |

The desktop label is per-resource, from `englishCrmMessages.ts` (`<CreateButton />` resolves
`resources.<name>.action.create`, falling back to `ra.action.create`):

| Resource | Desktop label |
| --- | --- |
| contacts | `Create contact` |
| companies | `Create Company` |
| deals | `Create deal` |
| tasks | `Add Task` |

## Notification (toast) texts

Assert the toast with the `dismissToast` fixture, never by re-deriving the string. The text
resolves per-resource first, then falls back to react-admin's generic one:

| Resource / action | Text |
| --- | --- |
| deal updated | `Deal updated` |
| task updated | `Task updated` |
| task added | `Task added` |
| profile updated | `Your profile has been updated` |
| anything with no override | react-admin's generic `Element created` / `Element updated` |

Contacts and companies have **no** create/update override, so they use the generic text.
If you need one that is not in this table, read `englishCrmMessages.ts`, which is the single
source, and `frenchCrmMessages.ts` must be updated alongside it.

`dismissToast` also waits out the optimistic-UI request, so it is how you sequence a save
before the next assertion:

```ts
await page.getByRole("button", { name: "Save" }).click();
await dismissToast("Element created");
```

## Fixtures available

From `e2e/fixtures.ts` (`import { test, expect } from "./fixtures"`):

| Fixture | Use |
| --- | --- |
| `resetDb` | automatic, truncates every table in FK-safe order before each spec |
| `createUser`, `createSales`, `createCompany`, `createContact`, `createNotes` | seed through the service-role client, far cheaper than driving the UI |
| `menu.goToDashboard()`, `menu.goToContacts()` | navigate by nav link, works in both projects |
| `dismissToast(text)` | assert a toast, close it, wait for the optimistic request |
| `CREATE_BUTTON`, `NOTIFICATION` | the label tables above, as constants |

**Seed data through the fixtures, not the UI.** Driving the create form to obtain a contact
you merely need to exist costs a page load and a save per record, on both projects.

## Login

Every spec starts logged out; there is no auth-state reuse:

```ts
await page.goto("/");
await page.getByLabel("Email").fill("john@doe.com");
await page.getByLabel("Password").fill("password");
await page.getByRole("button", { name: "Sign in" }).click();
```

## Verification

- [ ] Every viewport-dependent assertion is guarded with `isMobile` or `test.skip`.
- [ ] No assertion on a sort / bulk-select / column-header control without that guard.
- [ ] Toast texts come from `NOTIFICATION` or `englishCrmMessages.ts`, not from a guess.
- [ ] Setup data is seeded through the fixtures, not entered through the UI.
- [ ] The viewport is never widened to make an assertion pass.
