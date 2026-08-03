---
name: playwright-testing
description: Playwright E2E testing patterns — web-first assertions, user-visible locators, network interception, fixtures, authentication, and parallel execution. Use when building or reviewing E2E tests with Playwright, when setting up browser testing for a web app, or when migrating from Cypress or Selenium.
---

# Playwright E2E Testing

Reference for the assertion, locator, and structure patterns used inside an e2e spec. Browser-based end-to-end testing with auto-waiting, cross-browser support, and reliable locators.

## When to Use

- Writing or reviewing the body of a Playwright e2e spec.
- Setting up browser testing for the app (config, fixtures, auth, parallelism).
- Migrating tests from Cypress or Selenium.

For *whether* a change requires an e2e test and *where* the spec goes, see
`Skill({skill: "e2e-conventions"})`.

---

## 1. Web-First Assertions (Not Manual Checks)

Playwright's `expect(locator)` assertions **auto-retry** until the condition is met or the timeout expires. Never use `page.$()`, `page.evaluate()`, or manual boolean checks to verify element state.

### WRONG — manual element checks

```typescript
// Returns null immediately if element doesn't exist yet — race condition!
const el = await page.$('.order-confirmation');
expect(el).not.toBeNull();

// Evaluates once, no retry — flaky on slow renders
const text = await page.textContent('.status');
expect(text).toBe('Order received');

// Manual waitForSelector + isVisible — redundant, ignores auto-retry
await page.waitForSelector('.status');
const visible = await page.locator('.status').isVisible();
expect(visible).toBe(true);
```

### RIGHT — web-first assertions that auto-retry

```typescript
// Auto-retries until element is visible or timeout
await expect(page.getByText('Order received')).toBeVisible();

// Auto-retries until text matches
await expect(page.getByTestId('status')).toHaveText('Order received');

// Auto-retries for element count
await expect(page.getByRole('listitem')).toHaveCount(3);

// Auto-retries for attribute values
await expect(page.getByRole('button', { name: 'Submit' })).toBeEnabled();
```

**Why it matters:** `page.$()` and `page.textContent()` execute once and return immediately. If the UI hasn't rendered yet, the test fails intermittently. Web-first assertions (`expect(locator).toBeVisible()`, `.toHaveText()`, `.toHaveCount()`) retry automatically until the assertion passes or the timeout expires, making tests reliable without explicit waits.

---

## 2. Locator Strategy: User-Visible Locators Over CSS

Prefer locators that match what the user sees. CSS selectors break when class names, IDs, or DOM structure change.

### WRONG — CSS/XPath selectors

```typescript
page.locator('.btn-primary.submit-order');
page.locator('#order-form > div:nth-child(3) > button');
page.locator('//button[@class="submit"]');
```

### RIGHT — user-visible locators (priority order)

```typescript
// 1. BEST — role-based (matches accessible name)
page.getByRole('button', { name: 'Place Order' });
page.getByRole('heading', { name: /checkout/i });
page.getByRole('link', { name: 'View cart' });

// 2. GOOD — label, placeholder, text
page.getByLabel('Email address');
page.getByPlaceholder('Search products');
page.getByText('Order #42');

// 3. ACCEPTABLE — test IDs (for elements without accessible names)
page.getByTestId('order-status-badge');
```

**Why it matters:** `getByRole` tests your app the way a user (and a screen reader) interacts with it. CSS selectors like `.btn-primary` break on refactors. Test IDs are stable but don't validate accessibility — use them only as a fallback.

---

## 3. No Explicit Waits — Use Locator Assertions

Never use `page.waitForTimeout()`, `page.waitForSelector()`, or `setTimeout`. Playwright auto-waits on actions and web-first assertions.

### WRONG — explicit waits

```typescript
// Arbitrary timeout — slow and still flaky
await page.waitForTimeout(3000);
await page.click('.submit-btn');

// waitForSelector is redundant before a locator action
await page.waitForSelector('.product-card');
await page.locator('.product-card').first().click();
```

### RIGHT — rely on auto-waiting

```typescript
// Playwright auto-waits for the button to be actionable before clicking
await page.getByRole('button', { name: 'Submit' }).click();

// Web-first assertion auto-retries until products appear
await expect(page.getByRole('listitem')).toHaveCount(5);
await page.getByRole('listitem').first().click();
```

**Why it matters:** `waitForTimeout(3000)` is the #1 cause of slow test suites. Playwright already waits for elements to be visible, stable, and enabled before performing actions. Adding explicit waits is redundant and makes tests slower without adding reliability.

---

## 4. Network Interception with page.route()

Use `page.route()` to mock API responses for isolated, deterministic tests. Use `page.waitForResponse()` to assert on real API calls.

### Mocking API responses

```typescript
test('shows error when API fails', async ({ page }) => {
  await page.route('**/api/products', (route) =>
    route.fulfill({
      status: 500,
      contentType: 'application/json',
      body: JSON.stringify({ error: 'Internal server error' }),
    })
  );

  await page.goto('/');
  await expect(page.getByRole('alert')).toContainText(/error/i);
});

test('displays products from mocked API', async ({ page }) => {
  await page.route('**/api/products', (route) =>
    route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify([
        { id: 1, name: 'Widget', price: 9.99 },
        { id: 2, name: 'Gadget', price: 19.99 },
      ]),
    })
  );

  await page.goto('/');
  await expect(page.getByRole('listitem')).toHaveCount(2);
});
```

### Waiting for real API calls

```typescript
test('order submission calls the API', async ({ page }) => {
  await page.goto('/checkout');
  await page.getByLabel('Name').fill('Jane Doe');

  // Set up the response promise BEFORE triggering the action
  const responsePromise = page.waitForResponse('**/api/orders');
  await page.getByRole('button', { name: 'Place Order' }).click();
  const response = await responsePromise;

  expect(response.status()).toBe(201);
});
```

**Why it matters:** `page.route()` intercepts at the network level, so your UI code runs exactly as in production but with controlled data. Always set up `waitForResponse` **before** the action that triggers it to avoid race conditions.

---

## 5. Test Structure: test.describe and test.beforeEach

### WRONG — flat tests with repeated setup

```typescript
test('shows products', async ({ page }) => {
  await page.goto('/');
  await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
});

test('can add to cart', async ({ page }) => {
  await page.goto('/');
  await page.getByRole('button', { name: /add/i }).first().click();
  await expect(page.getByTestId('cart-count')).toHaveText('1');
});
```

### RIGHT — grouped tests with shared setup

```typescript
import { test, expect } from '@playwright/test';

test.describe('Product catalog', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/');
  });

  test('displays product listing', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /products/i })).toBeVisible();
    await expect(page.getByRole('listitem')).toHaveCount(5);
  });

  test('can add item to cart', async ({ page }) => {
    await page.getByRole('button', { name: /add/i }).first().click();
    await expect(page.getByTestId('cart-count')).toHaveText('1');
  });

  test('can search products', async ({ page }) => {
    await page.getByPlaceholder('Search').fill('widget');
    await expect(page.getByRole('listitem')).toHaveCount(1);
  });
});
```

**Why it matters:** `test.describe` groups related tests for readability and lets you share setup via `test.beforeEach`. Tests within a describe can also share hooks, annotations (like `test.slow()`), and configuration overrides.

---

## 6. Fixtures for Setup and Teardown

Use Playwright's fixture system to share setup logic across tests. Custom fixtures replace manual `beforeEach`/`afterEach` patterns and are composable.

### WRONG — manual setup in every test

```typescript
test('admin can manage users', async ({ page }) => {
  // Repeated in every admin test
  await page.goto('/login');
  await page.getByLabel('Email').fill('admin@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');

  // Actual test logic
  await page.goto('/admin/users');
  await expect(page.getByRole('table')).toBeVisible();
});
```

### RIGHT — custom fixture

```typescript
// e2e/fixtures.ts
import { test as base, expect } from '@playwright/test';

type Fixtures = {
  adminPage: import('@playwright/test').Page;
};

export const test = base.extend<Fixtures>({
  adminPage: async ({ page }, use) => {
    await page.goto('/login');
    await page.getByLabel('Email').fill('admin@example.com');
    await page.getByLabel('Password').fill('password');
    await page.getByRole('button', { name: 'Sign in' }).click();
    await page.waitForURL('/dashboard');
    await use(page);
    // Teardown runs automatically after test
  },
});

export { expect };

// e2e/admin.spec.ts
import { test, expect } from './fixtures';

test('admin can manage users', async ({ adminPage }) => {
  await adminPage.goto('/admin/users');
  await expect(adminPage.getByRole('table')).toBeVisible();
});
```

---

## 7. Authentication with storageState

For apps requiring login, authenticate once in a setup project and reuse the session via `storageState`. This avoids logging in before every test.

### playwright.config.ts — setup project

```typescript
import { defineConfig } from '@playwright/test';

export default defineConfig({
  projects: [
    { name: 'setup', testMatch: /.*\.setup\.ts/ },
    {
      name: 'chromium',
      dependencies: ['setup'],
      use: { storageState: 'e2e/.auth/user.json' },
    },
  ],
});
```

### e2e/auth.setup.ts — run once

```typescript
import { test as setup, expect } from '@playwright/test';

const authFile = 'e2e/.auth/user.json';

setup('authenticate', async ({ page }) => {
  await page.goto('/login');
  await page.getByLabel('Email').fill('user@example.com');
  await page.getByLabel('Password').fill('password');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForURL('/dashboard');
  await page.context().storageState({ path: authFile });
});
```

**Why it matters:** Without `storageState`, every test file repeats the login flow, which is slow and fragile. The setup project runs once, saves cookies/localStorage to a JSON file, and all dependent tests start already authenticated.

---

## 8. Page Object Model

Encapsulate page interactions in classes to reduce duplication and make tests resilient to UI changes.

```typescript
// e2e/pages/checkout.page.ts
import { type Page, type Locator, expect } from '@playwright/test';

export class CheckoutPage {
  readonly nameInput: Locator;
  readonly emailInput: Locator;
  readonly submitButton: Locator;
  readonly confirmationMessage: Locator;

  constructor(private page: Page) {
    this.nameInput = page.getByLabel('Full name');
    this.emailInput = page.getByLabel('Email');
    this.submitButton = page.getByRole('button', { name: 'Place Order' });
    this.confirmationMessage = page.getByText(/order.*confirmed/i);
  }

  async goto() {
    await this.page.goto('/checkout');
  }

  async fillAndSubmit(name: string, email: string) {
    await this.nameInput.fill(name);
    await this.emailInput.fill(email);
    await this.submitButton.click();
  }

  async expectConfirmation() {
    await expect(this.confirmationMessage).toBeVisible();
  }
}

// e2e/checkout.spec.ts
import { test, expect } from '@playwright/test';
import { CheckoutPage } from './pages/checkout.page';

test('completes checkout', async ({ page }) => {
  const checkout = new CheckoutPage(page);
  await checkout.goto();
  await checkout.fillAndSubmit('Jane Doe', 'jane@example.com');
  await checkout.expectConfirmation();
});
```

**Why it matters:** When the UI changes (button text, label wording), you update one page object instead of every test file. Page objects also keep test bodies focused on the user scenario, not DOM details.

---

## 9. Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test';

export default defineConfig({
  testDir: './e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    screenshot: 'only-on-failure',
    trace: 'on-first-retry',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'firefox', use: { ...devices['Desktop Firefox'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  webServer: {
    command: 'npm run dev',
    port: 3000,
    reuseExistingServer: !process.env.CI,
  },
});
```

### Key config settings

- **`fullyParallel: true`** — runs tests in parallel by default (Playwright's default). Do not disable unless tests share mutable state.
- **`forbidOnly: !!process.env.CI`** — fails CI if `test.only` is left in code.
- **`webServer`** — auto-starts your dev server before tests.
- **`trace: 'on-first-retry'`** — captures traces on first retry for debugging via `npx playwright show-trace`.
- **`screenshot: 'only-on-failure'`** — captures screenshots only when tests fail.

---

## 10. Visual Regression Testing

```typescript
test('homepage matches snapshot', async ({ page }) => {
  await page.goto('/');
  await expect(page).toHaveScreenshot('homepage.png');
});

test('product card renders correctly', async ({ page }) => {
  await page.goto('/products');
  await expect(page.getByTestId('product-card').first()).toHaveScreenshot('product-card.png', {
    maxDiffPixels: 100,
  });
});
```

Run `npx playwright test --update-snapshots` to generate baseline images. Snapshots are stored per-project (browser) and per-platform.

---

## References

- [Playwright Docs: Locators](https://playwright.dev/docs/locators)
- [Playwright Docs: Assertions](https://playwright.dev/docs/test-assertions)
- [Playwright Docs: Auto-waiting](https://playwright.dev/docs/actionability)
- [Playwright Docs: Network](https://playwright.dev/docs/network)
- [Playwright Docs: Authentication](https://playwright.dev/docs/auth)
- [Playwright Docs: Fixtures](https://playwright.dev/docs/test-fixtures)
- [Playwright Docs: Page Object Model](https://playwright.dev/docs/pom)

---

## Red Flags

- `page.$()` / `page.textContent()` / `isVisible()` checks instead of web-first assertions.
- CSS or XPath selectors where a `getByRole`/`getByLabel`/`getByText` locator exists.
- Any `waitForTimeout()`, or `waitForSelector()` before a locator action.
- `waitForResponse()` set up *after* the action that triggers the call.
- Login flow repeated per test instead of `storageState` or a fixture.
- `test.only` left in code, or `fullyParallel` disabled without a shared-state reason.

## Verification

- [ ] Web-first assertions (`expect(locator).toBeVisible()`) — never `page.$()` or `page.textContent()`
- [ ] User-visible locators (`getByRole`, `getByLabel`, `getByText`) over CSS selectors
- [ ] No explicit waits (`waitForTimeout`, `waitForSelector` before actions)
- [ ] `test.describe` groups related tests; `test.beforeEach` for shared setup
- [ ] `page.route()` for API mocking in isolated tests
- [ ] `page.waitForResponse()` set up before the triggering action
- [ ] `webServer` configured to start app automatically
- [ ] `fullyParallel: true` for parallel execution
- [ ] `forbidOnly: !!process.env.CI` to prevent `test.only` in CI
- [ ] Screenshots on failure (`screenshot: 'only-on-failure'`)
- [ ] Traces on retry (`trace: 'on-first-retry'`)
- [ ] Retries in CI (`retries: process.env.CI ? 2 : 0`)
- [ ] `storageState` for authentication reuse across tests
- [ ] Page objects encapsulate locators and actions for reusable pages
