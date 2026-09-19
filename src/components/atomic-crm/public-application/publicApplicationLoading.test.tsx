import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";
import { MemoryRouter } from "react-router";

import { LivingExampleApplicationPage } from "./LivingExampleApplicationPage";
import type { PublicApplicationDataSource } from "./publicApplicationDataSource";
import type { PublicOfferContext } from "./publicOfferContext";

// A public form has one visitor who cannot be asked to open a console.
//
// Both public pages loaded their context with .then() and no .catch(), and
// the data source THROWS when the application service cannot be reached.
// A rejection therefore left the state on "pending" forever and the page
// rendered null — a blank screen that never resolved, shown to a real
// prospective client while Leif waited for their application.

const individualContext: PublicOfferContext = {
  kind: "individual",
  offerId: 1,
  offerName: "The Living Example",
  isAccepting: true,
};

const buildDataSource = (
  getLivingExampleContext: PublicApplicationDataSource["getLivingExampleContext"],
): PublicApplicationDataSource =>
  ({
    getLivingExampleContext,
    getGroupCohortContext: async () => individualContext,
    submitApplication: async () => ({ status: "submitted" }),
  }) as unknown as PublicApplicationDataSource;

const renderPage = async (dataSource: PublicApplicationDataSource) => {
  await page.viewport(1000, 900);
  return render(
    <MemoryRouter initialEntries={["/apply/living-example"]}>
      <LivingExampleApplicationPage dataSource={dataSource} />
    </MemoryRouter>,
  );
};

describe("the public Living Example form", () => {
  it("renders the real questions once its context loads", async () => {
    // Arrange
    const screen = await renderPage(
      buildDataSource(async () => individualContext),
    );

    // Assert — the actual wording an applicant answers.
    await expect
      .element(
        screen.getByText(
          "What have you already tried to change or shift this?",
        ),
      )
      .toBeInTheDocument();
  });

  it("shows a human failure instead of spinning forever", async () => {
    // Arrange — exactly what the data source does when the application
    // service cannot be reached.
    const screen = await renderPage(
      buildDataSource(async () => {
        throw new Error("Failed to reach the application service.");
      }),
    );

    // Assert — something on screen, and something to do about it.
    await expect
      .element(screen.getByText("This form didn't load just now."))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeInTheDocument();
  });

  it("never shows the visitor a technical error", async () => {
    // Arrange — a visitor cannot act on this, and it is not theirs to see.
    const screen = await renderPage(
      buildDataSource(async () => {
        throw new Error("permission denied for table application_responses");
      }),
    );
    await expect
      .element(screen.getByText("This form didn't load just now."))
      .toBeInTheDocument();

    // Assert
    const text = screen.container.textContent ?? "";
    expect(text).not.toContain("permission denied");
    expect(text).not.toContain("application_responses");
  });

  it("recovers when the visitor retries", async () => {
    // Arrange — fails once, then succeeds.
    let attempts = 0;
    const screen = await renderPage(
      buildDataSource(async () => {
        attempts += 1;
        if (attempts === 1) throw new Error("transient");
        return individualContext;
      }),
    );
    await expect
      .element(screen.getByRole("button", { name: "Try again" }))
      .toBeInTheDocument();

    // Act
    await screen.getByRole("button", { name: "Try again" }).click();

    // Assert — the form itself, not a permanent dead end.
    await expect
      .element(
        screen.getByText(
          "What have you already tried to change or shift this?",
        ),
      )
      .toBeInTheDocument();
  });
});
