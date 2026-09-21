import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render } from "vitest-browser-react";
import { memoryStore } from "ra-core";
import { MemoryRouter } from "react-router";

import { CRM } from "../root/CRM";
import { testI18nProvider } from "../providers/commons/i18nProvider";
import { createDataProvider } from "../providers/fakerest";
import {
  buildContact,
  createCrmDb,
  createTestAuthProvider,
} from "@/test/StoryWrapper";
import type { Deal, Enrollment, Offer } from "../types";

// The Living Example program page, against the real shape of Leif's
// practice on 2026-09-21: twelve people he is working with, six more who
// have agreed and not started, and not one end_date anywhere.
//
// The page used to say "18 / 12 active · 0 openings" and "No upcoming
// openings." Both numbers came from the same rows, and both were wrong in
// the same way — a status column read without its dates.

const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  duration_months: 4,
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// start date -> the person, exactly as production had them.
//
// All eighteen Start Weeks are owner-stated. Four of them had to be
// corrected off the values the CRM inferred from first bookings, which is
// why inference was the wrong rule: Jules 24 Jun -> 20 May, Gigi 19 Jul ->
// 20 Jul, Mackenzie 29 Jul -> 3 Aug, Denise 30 Sep -> 5 Oct.
const OCCUPIED: [string, string][] = [
  ["2026-05-20", "Jules Litman-Cleper"],
  ["2026-06-14", "Adriano Castro"],
  ["2026-06-14", "Jess Beauchamp"],
  ["2026-07-20", "Gigi George"],
  ["2026-07-20", "Mia Cosme"],
  ["2026-07-20", "Emily Loeb"],
  ["2026-07-20", "Morgan Schenkeveld"],
  ["2026-08-03", "Mackenzie Stabler"],
  ["2026-08-17", "Sarah Monast"],
  ["2026-08-17", "Erik Amundson"],
  ["2026-09-10", "Pete Bassett"],
  ["2026-09-16", "Gina McNamara"],
];
// Owner-stated: Leif confirmed every one of these Start Weeks.
const COMMITTED: [string, string][] = [
  ["2026-10-05", "Denise Cormier"],
  ["2026-10-05", "Ava Frotton"],
  ["2026-11-08", "Daniel Alexander"],
  ["2026-11-08", "Heidi Elias"],
  ["2026-11-08", "Linda Turner"],
  ["2026-11-08", "Emma Wijns"],
];

const buildTestCrm = () => {
  const people = [...OCCUPIED, ...COMMITTED];
  const contacts = people.map(([, name], index) => {
    const [first, ...rest] = name.split(" ");
    return buildContact({
      id: index + 1,
      first_name: first,
      last_name: rest.join(" "),
    });
  });
  const deals: Deal[] = people.map((_, index) => ({
    id: index + 1,
    name: people[index]![1],
    contact_id: index + 1,
    offer_id: 1,
    stage: "won",
    outcome: null,
    amount: 4000,
    offer_name_snapshot: "The Living Example",
    offer_price_snapshot: 4000,
    sales_id: 0,
    index: 0,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    stage_entered_at: "2026-01-01T00:00:00.000Z",
  }));
  const enrollments: Enrollment[] = people.map(([start], index) => ({
    id: index + 1,
    opportunity_id: index + 1,
    onboarding_tracking: "tracked" as const,
    // Every one of them is "active" in the database. That is exactly why
    // the status column alone could never answer the question.
    status: "active",
    start_date: start,
    end_date: null,
    // Every one of the eighteen is owner-stated now.
    start_date_source: "owner" as const,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
  }));

  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts,
      offers: [livingExample],
      deals,
      enrollments,
      waitlist_entries: [
        {
          id: 1,
          contact_id: 1,
          offer_id: 1,
          cohort_id: null,
          status: "waiting",
          joined_at: "2026-09-12T00:00:00.000Z",
          source: "instagram",
          created_at: "2026-09-12T00:00:00.000Z",
          updated_at: "2026-09-12T00:00:00.000Z",
        },
      ],
      tasks: [],
    } as any),
    silent: true,
    latency: 0,
  });

  return (
    <MemoryRouter initialEntries={["/programs/individual/1"]}>
      <CRM
        dataProvider={dataProvider}
        authProvider={createTestAuthProvider()}
        i18nProvider={testI18nProvider}
        store={memoryStore()}
        disableTelemetry
      />
    </MemoryRouter>
  );
};

describe("Living Example program page — capacity Leif can plan around", () => {
  beforeEach(() => {
    vi.useFakeTimers({ shouldAdvanceTime: true });
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it("counts the twelve people Leif is working with, not the eighteen agreements", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByText("12 / 12 active", { exact: false }))
      .toBeVisible();
    expect(screen.container.textContent).not.toContain("18 / 12");
  });

  it("names the six who have agreed but not started, under their own heading", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Starting Later" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("6 starting later", { exact: false }))
      .toBeVisible();
    // Daniel Alexander starts on 8 November. He is under Starting Later,
    // not among the current clients — the exact row whose seven-week-early
    // appearance under Current Clients started all of this.
    const startingLater = screen.container.ownerDocument.body.textContent ?? "";
    const currentClientsBlock = startingLater.slice(
      startingLater.indexOf("Current Clients"),
      startingLater.indexOf("Starting Later"),
    );
    expect(currentClientsBlock).not.toContain("Daniel Alexander");
    await expect
      .element(screen.getByRole("link", { name: "Daniel Alexander" }))
      .toBeVisible();
  });

  it("shows a projected finish for a client whose end date nobody recorded", async () => {
    const screen = await render(buildTestCrm());

    // Adriano started 14 June; four months is October. The month, and the
    // word "expected" — never a precise-looking day nobody promised.
    await expect
      .element(
        screen
          .getByText("expected to end October 2026", { exact: false })
          .first(),
      )
      .toBeVisible();
  });

  it("reports openings by month, net of the starts already sold", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Upcoming Openings" }))
      .toBeVisible();

    const text = screen.container.textContent ?? "";

    // Two clients finish in October and four in November, and neither
    // month is an opening: sixteen people are in the programme on 8
    // November. Anybody started before then would have been the
    // seventeenth in a practice that holds twelve — the exact number
    // the first version of this page got wrong in Leif's favour.
    expect(text).toContain("October 2026");
    expect(text).toContain("November 2026 — no opening");
    expect(text).toContain("4 over capacity at its peak");
    expect(text).toContain("Peak 16 in the programme");

    // January is the first month he could safely start somebody.
    expect(text).toContain("December 2026 — no opening");
    expect(text).toContain("January 2027 — 3 openings");
  });

  it("says who is past their projected four months and still current", async () => {
    // Jules started on 20 May; four months ran out yesterday, and Leif
    // still considers him a current client. He keeps his slot — and
    // that single fact is why December shows no opening, so the page
    // has to say it rather than leave Leif wondering.
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Upcoming Openings" }))
      .toBeVisible();
    const text = screen.container.textContent ?? "";
    expect(text).toContain(
      "Past their projected four months and still current: Jules Litman-Cleper",
    );
    expect(text).toContain("They keep their slot until you record an end.");

    // Every Start Week is confirmed, so nothing is flagged provisional.
    expect(text).not.toContain("start weeks to confirm");
    expect(text).not.toContain("Start week not confirmed");
  });
  it("states availability beside the waitlist, and offers no way to act on it", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByText("Full — 12 of 12 slots filled."))
      .toBeVisible();
    // Reporting only. Nothing here invites, moves, emails, or promotes
    // anybody — who gets an opening stays Leif's decision.
    const text = screen.container.textContent ?? "";
    expect(text).not.toContain("Invite to Book");
    expect(text).not.toContain("Offer this spot");
  });

  it("puts + Add to Waitlist at the waitlist itself", async () => {
    // Leif adds people arriving from Instagram by hand. The control used
    // to live only in the page header, four sections above the list it
    // adds to.
    const screen = await render(buildTestCrm());

    const button = screen.getByRole("button", { name: "Add to Waitlist" });
    await expect.element(button).toBeVisible();

    const heading = screen.container.ownerDocument.body.textContent ?? "";
    expect(heading).toContain("Waitlist");
    // The button and the Waitlist heading share a row.
    const buttonEl = await button.element();
    expect(buttonEl.closest("div")?.parentElement?.textContent).toContain(
      "Waitlist",
    );
  });
});
