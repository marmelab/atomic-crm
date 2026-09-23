import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page } from "vitest/browser";

import { StoryWrapper } from "@/test/StoryWrapper";
import { SyncCalendarButton } from "./SyncCalendarButton";

// Where "Last synced" is allowed to take up space, and where it only
// whispers.
//
// The 1:1 Program page is where Leif reasons about the calendar, so how
// fresh it is belongs on screen there. In the Dashboard header it does
// not: a caption under one of two side-by-side buttons made the pair look
// lopsided and pulled the row out of line with the heading. The date is
// not dropped in that case — it moves to the button's tooltip, which
// costs no layout.

const LAST_SYNCED = "2026-09-22T17:30:00.000Z";

const show = (props: Parameters<typeof SyncCalendarButton>[0]) =>
  render(
    <StoryWrapper data={{}}>
      <SyncCalendarButton {...props} />
    </StoryWrapper>,
  );

describe("Sync Calendar's last-synced date", () => {
  it("is shown as its own line by default, as the Program page renders it", async () => {
    show({ lastSyncedAt: LAST_SYNCED });

    await expect.element(page.getByText(/Last synced/)).toBeInTheDocument();
  });

  it("takes no visible space in the Dashboard header, but stays on the tooltip", async () => {
    show({ lastSyncedAt: LAST_SYNCED, showLastSynced: false });

    const button = page.getByRole("button", { name: "Sync Calendar" });
    await expect.element(button).toBeVisible();
    // The fact is still reachable — just not occupying the layout.
    await expect
      .element(button)
      .toHaveAttribute("title", expect.stringContaining("Last synced"));
    expect(document.body.textContent).not.toContain("Last synced");
  });

  it("carries no tooltip when the calendar has never been synced", async () => {
    show({ showLastSynced: false });

    const button = page.getByRole("button", { name: "Sync Calendar" });
    await expect.element(button).toBeVisible();
    expect(button.element().getAttribute("title")).toBeNull();
  });
});
