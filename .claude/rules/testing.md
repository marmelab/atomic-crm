---
paths: []
---

# Testing

## Minimum coverage: 80%

New code paths without tests are a blocking issue in code review. But coverage is a
FLOOR, not a target: never write a test just to reach the number (that is what produces
filler tests). Pertinence outranks the percentage.

## Pertinence: test behavior, not implementation

- Assert user-observable behavior / rendered output (Testing Library principle: "the more
  your tests resemble the way the software is used, the more confidence they give"). Never
  assert internal state, props, private methods, or merely that a mock was called.
- Weight toward integration for this React app (the Testing Trophy): a component with its
  real collaborators over many shallow unit tests. Never test the framework or a third-party
  library.
- Delete a test ONLY for lack of intrinsic value (cannot name a realistic bug it would catch,
  tautological, implementation-detail, snapshot-only, redundant with a better test), NEVER
  because "the code works now" or to cap the count: a passing test exists to guard FUTURE
  regressions. Shrink the suite by CONSOLIDATING redundancy, not by deleting coverage.
- Forbidden (blocking in review): asserting a mock returns its configured value; a snapshot
  as the primary assertion; reading component state / props / internals; a test written only
  to raise the coverage number.

## TDD orientation: acceptance-test-driven

- Derive each test from the ticket's `acceptance_criteria`; every test should map to a
  criterion or a user-visible behavior. A test with no traceable criterion is filler.
- Enforce the OUTCOME (behavior tests present and green), not literal red-green ordering
  (unverifiable when one agent writes both the test and the code).

## Test structure — AAA pattern

Prefer Arrange-Act-Assert for all tests:

    test('calculates similarity correctly', () => {
      // Arrange
      const input = buildInput()

      // Act
      const result = compute(input)

      // Assert
      expect(result).toBe(expected)
    })

## Test naming

Use descriptive names that explain the behavior under test:

- returns empty array when no items match the query
- throws error when required field is missing
- falls back to default value when API is unavailable

Avoid: test1, testFoo, should work.

## Test isolation

Each test must be independent — no shared mutable state.
No test should depend on the execution order of other tests.
Reset mocks and fixtures in beforeEach, not globally.

## E2E shape (Playwright)

    import { test, expect } from '@playwright/test'

    test('ticket list loads', async ({ page }) => {
      await page.goto('/tickets')
      await expect(page.locator('h1')).toBeVisible()
    })

Never use timeout-based assertions (waitForTimeout).
Always prefer deterministic waits: waitForResponse, waitForSelector,
expect(locator).toBeVisible(). Flaky tests must be quarantined with
test.fixme() and a tracking reference before merge.