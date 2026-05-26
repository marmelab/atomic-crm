---
name: e2e-conventions
description: When to write e2e tests, where to put them, and how to verify them. Apply to any task touching UI, filters, forms, or interactions.
---

## When e2e tests are required

A change **requires** an e2e test if it touches any of:

- UI components or pages
- Filters or search
- Forms or user input
- Interactions (click, drag, keyboard)

Exception: pure CSS or a DB-migration-only change. State this explicitly in the task notes.

## Where to put them

Under `e2e/`, named after the feature:

```
e2e/<feature-name>.spec.ts
```

If the work is tracked under a ticket id, you may prefix the file with it (e.g. `e2e/TASK-001-deal-importance.spec.ts`) to make it easy to find — but the ticket id is not required.

## What to verify

Write the spec alongside the implementation. The reviewer checks that the spec exists and asserts the right thing. CI runs it — don't run it locally yourself.

See [playwright-testing](../playwright-testing/SKILL.md) for the assertion / locator patterns to use inside the spec.
