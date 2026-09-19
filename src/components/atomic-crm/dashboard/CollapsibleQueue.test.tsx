import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { CollapsibleQueue } from "./CollapsibleQueue";
import { StoryWrapper } from "@/test/StoryWrapper";

// A Dashboard queue stays five rows tall, and nothing disappears.
//
// The objective is only that the Dashboard stays compact while the work
// remains reachable — so the collapsed state must SAY how much is hidden,
// and it must be possible to close it again.

const rows = (count: number) =>
  Array.from({ length: count }, (_, index) => (
    <div key={index}>Queue row {index + 1}</div>
  ));

const renderQueue = async (count: number) => {
  await page.viewport(1000, 800);
  return render(
    <StoryWrapper>
      <CollapsibleQueue itemCount={count}>{rows(count)}</CollapsibleQueue>
    </StoryWrapper>,
  );
};

describe("CollapsibleQueue", () => {
  it("shows every row when there are five or fewer", async () => {
    // Act
    const screen = await renderQueue(5);

    // Assert — no affordance at all; there is nothing hidden to announce.
    await expect.element(screen.getByText("Queue row 5")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("Show all");
  });

  it("shows the first five and says how many there are", async () => {
    // Act
    const screen = await renderQueue(8);

    // Assert
    await expect.element(screen.getByText("Queue row 5")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("Queue row 6");
    await expect.element(screen.getByText("Show all 8")).toBeInTheDocument();
  });

  it("reveals the whole queue, and closes again", async () => {
    // Arrange
    const screen = await renderQueue(8);

    // Act — expand.
    await screen.getByText("Show all 8").click();

    // Assert — nothing is lost.
    await expect.element(screen.getByText("Queue row 8")).toBeInTheDocument();

    // Act — collapse. This used to be one-way, so a long queue pushed
    // everything below it off the screen for the rest of the session.
    await screen.getByText("Show fewer").click();

    // Assert
    await expect.element(screen.getByText("Show all 8")).toBeInTheDocument();
    expect(screen.container.textContent).not.toContain("Queue row 6");
  });
});
