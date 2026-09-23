import { beforeEach, describe, expect, it, vi } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper } from "@/test/StoryWrapper";
import { SyncAllStripeButton } from "./SyncAllStripeButton";

// What the Dashboard's Sync Stripe button does in a person's hands.
//
// The authorization itself is proven on the server, where it lives
// (supabase/functions/stripe_webhook/ownerStripeSync.test.ts). What is
// left to prove here is the part Leif experiences: it says what changed,
// it cannot be double-clicked into two sweeps of the Stripe account, and
// a refusal reads as a refusal rather than as a broken button.

const syncStripeForEveryone = vi.hoisted(() => vi.fn());
// Only this one action is stood in for — the per-person sync and the
// discovery calls are still the real ones, because other parts of the app
// rendered by the wrapper import them.
vi.mock("./syncStripe", async (importOriginal) => ({
  ...(await importOriginal<typeof import("./syncStripe")>()),
  syncStripeForEveryone,
}));

const show = () =>
  render(
    <StoryWrapper data={{}}>
      <SyncAllStripeButton />
    </StoryWrapper>,
  );

describe("Sync Stripe, from the Dashboard", () => {
  beforeEach(() => {
    syncStripeForEveryone.mockReset();
  });

  it("reports what the sweep actually changed", async () => {
    syncStripeForEveryone.mockResolvedValue({
      status: "synced",
      message:
        "Stripe synced — 3 updates applied, 42 Stripe customers checked.",
    });

    show();
    await page.getByRole("button", { name: "Sync Stripe" }).click();

    await expect
      .element(page.getByText(/3 updates applied/))
      .toBeInTheDocument();
  });

  it("says plainly when the account is not allowed to do it", async () => {
    // Not an error and not silence. The server refused, and the person
    // deserves to know it will keep refusing.
    syncStripeForEveryone.mockResolvedValue({
      status: "not-authorized",
      message: "Only an account administrator can sync all of Stripe.",
    });

    show();
    await page.getByRole("button", { name: "Sync Stripe" }).click();

    await expect
      .element(page.getByText(/Only an account administrator/))
      .toBeInTheDocument();
  });

  it("cannot be clicked into a second sweep while the first is running", async () => {
    const held: { release?: () => void } = {};
    syncStripeForEveryone.mockImplementation(
      () =>
        new Promise((resolve) => {
          held.release = () =>
            resolve({ status: "synced", message: "Stripe synced — done." });
        }),
    );

    show();
    const button = page.getByRole("button", { name: "Sync Stripe" });
    await button.click();

    const running = page.getByRole("button", { name: "Syncing…" });
    await expect.element(running).toBeDisabled();
    expect(syncStripeForEveryone).toHaveBeenCalledTimes(1);

    held.release?.();
    await expect.element(page.getByText(/Stripe synced/)).toBeInTheDocument();
    expect(syncStripeForEveryone).toHaveBeenCalledTimes(1);
  });
});
