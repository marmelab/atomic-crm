import "@/index.css";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { Notification } from "@/components/admin/notification";
import { testI18nProvider } from "@/components/atomic-crm/providers/commons/i18nProvider";
import { createDataProvider } from "@/components/atomic-crm/providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type {
  Deal,
  Enrollment,
  EnrollmentOnboardingItem,
  Offer,
} from "@/components/atomic-crm/types";

// Human-acceptance repair, round 4: the not-allowed cursor Leif kept
// seeing was never about the checkbox's resting-state CSS (already proven
// correct with real Tailwind CSS loaded, see the prior round's
// investigation) — it's about the ~1s window a real Supabase round-trip
// takes while `pendingItemId` was passed straight through as the
// checkbox's `disabled` prop (ClientShow.tsx's own OnboardingItemRow). A
// genuinely `disabled` control correctly earns index.css's own
// `button:disabled { cursor: not-allowed }` — that's not a bug in the
// cursor rule, it's the wrong control being marked disabled. This test
// proves the actual click -> pending -> resolved -> click-again -> pending
// -> resolved sequence never once reports `cursor: not-allowed`, using a
// manually-resolvable deferred promise instead of a real timer so the
// "during pending" moment is captured deterministically, not guessed at
// with a sleep.
const gyuOffer: Offer = {
  id: 2,
  name: "Growing Yourself Up",
  type: "group",
  duration: "8 weeks",
  current_price: 1400,
  is_active: true,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
};

const wonDeal: Deal = {
  id: 1,
  name: "Ada Lovelace — Growing Yourself Up",
  contact_id: 1,
  offer_id: 2,
  stage: "won",
  outcome: null,
  amount: 1400,
  offer_name_snapshot: "Growing Yourself Up",
  offer_price_snapshot: 1400,
  selected_payment_option_id: 5,
  selected_payment_total: 1400,
  selected_installment_count: 2,
  selected_installment_amount: 700,
  sales_id: 0,
  index: 0,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  stage_entered_at: "2026-01-01T00:00:00.000Z",
};

const enrollment: Enrollment = {
  id: 1,
  opportunity_id: 1,
  status: "onboarding",
  start_date: null,
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const buildItem = (
  overrides: Partial<EnrollmentOnboardingItem> = {},
): EnrollmentOnboardingItem => ({
  id: 1,
  enrollment_id: 1,
  requirement_key: "slack_access",
  label: "Slack access",
  task_text_template: "Add {name} to Slack",
  is_required: true,
  sort_order: 1,
  status: "pending",
  completed_at: null,
  external_ref: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

// A Promise this test controls the resolution of, so "during the pending
// mutation" is an exact moment we choose, never a guessed sleep duration.
const createDeferred = <T,>() => {
  let resolve!: (value: T) => void;
  const promise = new Promise<T>((res) => {
    resolve = res;
  });
  return { promise, resolve };
};

describe("ClientShow — onboarding checkbox cursor during the pending mutation window", () => {
  it("never shows the not-allowed cursor across click -> pending -> resolved -> click-again -> pending -> resolved", async () => {
    await page.viewport(1280, 900);
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [
          buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
        ],
        offers: [gyuOffer],
        deals: [wonDeal],
        enrollments: [enrollment],
        enrollment_onboarding_items: [buildItem()],
        tasks: [],
      }),
      silent: true,
    });

    // Intercept only the checklist item's own update — completeOnboarding
    // Item.ts/reopenOnboardingItem.ts both await this call first, so
    // delaying it keeps the real `pendingItemId` state (and thus whatever
    // the checkbox renders) pinned exactly as long as this test wants. A
    // fresh wrapper object (never mutating the original provider in place)
    // avoids any risk of other composed methods still closing over the
    // original, un-intercepted `update`.
    let deferred = createDeferred<void>();
    const interceptedDataProvider: typeof dataProvider = {
      ...dataProvider,
      update: (resource, params) => {
        if (resource === "enrollment_onboarding_items") {
          return deferred.promise.then(() =>
            dataProvider.update(resource, params),
          );
        }
        return dataProvider.update(resource, params);
      },
    };

    const screen = await render(
      <MemoryRouter initialEntries={["/enrollments/1/show"]}>
        <CRM
          dataProvider={interceptedDataProvider}
          authProvider={createTestAuthProvider()}
          i18nProvider={testI18nProvider}
          store={memoryStore()}
          disableTelemetry
          layout={({ children }) => (
            <>
              {children}
              <Notification />
            </>
          )}
        />
      </MemoryRouter>,
    );

    const getCheckbox = () =>
      document.querySelector('[data-slot="checkbox"]') as HTMLElement;
    const getCheckboxCursor = () =>
      window.getComputedStyle(getCheckbox()).cursor;

    // 1. Resting, actionable, unchecked.
    await expect
      .element(screen.getByRole("checkbox").first())
      .toBeInTheDocument();
    expect(getCheckboxCursor()).toBe("pointer");

    // 2. Click — completes the item. A native DOM click (not a Playwright
    // pointer-coordinate click): this test environment's Tailwind pipeline
    // doesn't resolve the `--spacing` custom property `size-4` depends on
    // (confirmed empty at :root here — unrelated to the app itself, the
    // real dev server's own compiled CSS resolves it correctly), collapsing
    // the button to a 0×0 box no coordinate-based click can target. A
    // native `.click()` still dispatches the real event React listens for.
    getCheckbox().click();

    // 3. Inspect DURING the pending mutation: never not-allowed.
    expect(getCheckboxCursor()).toBe("pointer");
    await expect
      .element(screen.getByRole("checkbox").first())
      .not.toHaveAttribute("disabled");

    // 4. Mutation completes.
    deferred.resolve();
    await expect.element(screen.getByRole("checkbox").first()).toBeChecked();

    // 5. Checkbox remains correctly checked (state settled, not lied about).
    expect(getCheckboxCursor()).toBe("pointer");

    // 6. Click again to reopen.
    deferred = createDeferred<void>();
    getCheckbox().click();

    // 7. Inspect the pending state again: still never not-allowed.
    expect(getCheckboxCursor()).toBe("pointer");
    await expect
      .element(screen.getByRole("checkbox").first())
      .not.toHaveAttribute("disabled");

    // 8. Mutation completes.
    deferred.resolve();
    await expect
      .element(screen.getByRole("checkbox").first())
      .not.toBeChecked();

    // 9. State remains correct, cursor still normal.
    expect(getCheckboxCursor()).toBe("pointer");
  });
});
