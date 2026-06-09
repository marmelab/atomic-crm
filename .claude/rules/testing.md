---
paths: []
---

# Testing

## Minimum coverage: 80%

New code paths without tests are a blocking issue in code review.

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