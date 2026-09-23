import { describe, expect, it, beforeEach, afterEach, vi } from "vitest";
import { render } from "vitest-browser-react";
import { commands } from "vitest/browser";
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
// practice on 2026-09-21 and his real Year Tracking calendar.
//
// The page has been wrong here twice. It said "18 / 12 active · 0
// openings", adding six people who had not started to the twelve who had.
// Then it worked out ends with start + four months, which on this calendar
// is wrong by months: there is no eligible `1:1s` week at all between 2
// July and 13 September 2026.

const livingExample: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  max_active_clients: 12,
  is_active: true,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

// Leif's own `1:1s` weeks, from production. Note the summer gap, and that
// the calendar stops on 24 January 2027.
const CALENDAR_WEEKS: [string, string][] = [
  ["2026-05-17", "2026-05-21"],
  ["2026-06-14", "2026-06-18"],
  ["2026-06-21", "2026-06-25"],
  ["2026-06-28", "2026-07-02"],
  ["2026-09-13", "2026-09-17"],
  ["2026-09-20", "2026-09-24"],
  ["2026-09-27", "2026-10-01"],
  ["2026-10-04", "2026-10-08"],
  ["2026-10-11", "2026-10-15"],
  ["2026-10-18", "2026-10-22"],
  ["2026-11-08", "2026-11-12"],
  ["2026-11-15", "2026-11-19"],
  ["2026-11-29", "2026-12-03"],
  ["2026-12-06", "2026-12-10"],
  ["2026-12-13", "2026-12-17"],
  ["2027-01-03", "2027-01-07"],
  ["2027-01-10", "2027-01-14"],
  ["2027-01-24", "2027-01-28"],
];

// Start Date -> the person. All eighteen are owner-stated.
const OCCUPIED: [string, string][] = [
  ["2026-05-20", "Jules Litman-Cleper"],
  ["2026-06-14", "Adriano Castro"],
  ["2026-06-14", "Jess Beauchamp"],
  ["2026-07-20", "Emily Loeb"],
  ["2026-07-20", "Gigi George"],
  ["2026-07-20", "Mia Cosme"],
  ["2026-07-20", "Morgan Schenkeveld"],
  ["2026-08-03", "Mackenzie Stabler"],
  ["2026-08-17", "Erik Amundson"],
  ["2026-08-17", "Sarah Monast"],
  ["2026-09-10", "Pete Bassett"],
  ["2026-09-16", "Gina McNamara"],
];
const COMMITTED: [string, string][] = [
  ["2026-10-05", "Ava Frotton"],
  ["2026-10-05", "Denise Cormier"],
  ["2026-11-08", "Daniel Alexander"],
  ["2026-11-08", "Emma Wijns"],
  ["2026-11-08", "Heidi Elias"],
  ["2026-11-08", "Linda Turner"],
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
      expected_session_windows: CALENDAR_WEEKS.map(([start, end], i) => ({
        id: i + 1,
        offer_id: 1,
        external_calendar_id: "year-tracking",
        external_event_id: `week-${i + 1}`,
        raw_title: "1:1s",
        window_start: start,
        window_end: end,
        deleted_at: null,
        synced_at: "2026-09-20T00:00:00.000Z",
        created_at: "2026-01-01T00:00:00.000Z",
        updated_at: "2026-09-20T00:00:00.000Z",
      })),
      client_session_cadence_issues: [],
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
  // Two things this file is answering about, pinned rather than inherited.
  //
  // THE CLOCK. Every number here is a statement about "now": twelve people
  // have started and six have not, and which side of that line somebody
  // falls on is `start_date` compared against today. It used to fake the
  // whole timer API with `shouldAdvanceTime`, which keeps the clock
  // MOVING — measured, "now" had already drifted to 12:00:01 by the time
  // the page rendered. Faking only Date freezes it exactly where the test
  // says it is, and leaves setTimeout, setInterval and requestAnimationFrame
  // real, so nothing the browser or Playwright waits on is routed through a
  // clock this test controls. It is the smallest strategy that still gives
  // the test the one thing it actually needs, and it halves the file's
  // runtime because the page no longer waits on a stepped clock.
  //
  // THE TIMEZONE. The fixture is built from bare date strings, and those
  // parse as UTC midnight — so `new Date("2026-09-16")` is 16 September in
  // UTC and 15 September in Denver, measured. Every start date in this file
  // therefore lands on a different calendar day depending on where the test
  // runs, and a capacity answer is a statement about weeks. The assertions
  // below survive that shift today, but leaving it to the ambient machine
  // is exactly the kind of thing that makes a suite pass in one place and
  // fail in another. This repo already fixed that class of bug once, in
  // postponeTaskDate.test.ts, and the CDP command it added is what pins it.
  //
  // Neither of these is a proven explanation of the CI failure this file
  // has been showing — that cause is still open. They are two places this
  // test was taking an answer from the machine instead of stating it.
  //
  // The ambient zone is captured and restored the same way
  // postponeTaskDate.test.ts does it, so this file never leaves another
  // one running in a timezone it did not choose.
  let ambientTimezone: string;

  beforeEach(async () => {
    ambientTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
    await commands.setTimezone("UTC");
    vi.useFakeTimers({ toFake: ["Date"] });
    vi.setSystemTime(new Date("2026-09-21T12:00:00Z"));
  });
  afterEach(async () => {
    vi.useRealTimers();
    await commands.setTimezone(ambientTimezone);
  });

  it("counts the twelve people Leif is working with, not the eighteen agreements", async () => {
    const screen = await render(buildTestCrm());

    // Twice on the page now — the header and the "Right now" panel — and
    // both have to say twelve. Six people have agreed to start; an
    // agreement is not an occupancy.
    await expect
      .element(screen.getByText("12 / 12 active", { exact: false }).first())
      .toBeVisible();
    expect(screen.container.textContent).not.toContain("18 / 12");
    expect(screen.container.textContent).toContain("6 committed to start");
  });

  it("names the six who have agreed but not started, under their own heading", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Starting Later" }))
      .toBeVisible();
    await expect
      .element(screen.getByText("6 starting later", { exact: false }))
      .toBeVisible();
    // Daniel Alexander starts on 8 November — under Starting Later, not
    // among the current clients. The exact row whose seven-week-early
    // appearance under Current Clients started all of this.
    const text = screen.container.ownerDocument.body.textContent ?? "";
    const currentBlock = text.slice(
      text.indexOf("Current Clients"),
      text.indexOf("Starting Later"),
    );
    expect(currentBlock).not.toContain("Daniel Alexander");
  });

  it("shows a final session week worked out from the calendar, not from four months", async () => {
    const screen = await render(buildTestCrm());

    // Jules started 20 May. Four calendar months is 20 September — the old
    // model had already ended him. His twelve eligible `1:1s` weeks run to
    // the week of 15 November, because the summer contains none.
    await expect
      .element(
        screen
          .getByText("expected final session week", { exact: false })
          .first(),
      )
      .toBeVisible();
    expect(screen.container.textContent).toContain(
      "expected final session week Nov 15, 2026",
    );
  });

  it("refuses to offer an opening it cannot stand behind", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Upcoming Openings" }))
      .toBeVisible();
    const text = screen.container.textContent ?? "";

    // No month can be answered at all: Year Tracking stops on 24 January,
    // so a new client starting in any of them has nowhere to put their
    // twelfth session week. That is "can't calculate", which is a
    // different thing from "no openings" — and never "0 openings".
    expect(text).toContain("Can't calculate");
    expect(text).not.toContain("1 opening");
    expect(text).not.toContain("Peak 18");

    // Eighteen people are in the programme in the week of 8 November —
    // six over — and that detail lives in the breakdown now rather than on
    // every month card. Said with its unit and its ceiling, because "Peak
    // 18 in the programme" was read as "do I have 18 people enrolled?".
    await screen
      .getByRole("button", { name: /November 2026/ })
      .first()
      .click();
    await expect.element(screen.getByRole("dialog")).toBeVisible();

    const dialog = screen.container.ownerDocument.body.textContent ?? "";
    expect(dialog).toContain("18 active");
    expect(dialog).toContain("capacity 12");
    expect(dialog).toContain("6 over");
    // The mechanism is still available, underneath the answer rather than
    // instead of it.
    expect(dialog).toContain("session weeks");
  });

  it("says whose end the calendar cannot reach, and what to do about it", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Upcoming Openings" }))
      .toBeVisible();
    const text = screen.container.textContent ?? "";

    // Not "no programme length to work one out from": the 1:1 programme
    // has a length and it is twelve sessions. What is missing is calendar.
    expect(text).toContain("Year Tracking doesn't reach their 12th session");
    expect(text).not.toContain("no programme length");
    // And the one thing Leif can actually do.
    expect(text).toContain("Add more 1:1 weeks");
    expect(text).toContain("Sync Calendar");
    for (const [, name] of COMMITTED) expect(text).toContain(name);
  });

  it("lists current clients newest first, and future clients soonest first", async () => {
    // Two lists, two questions. Current Clients is who Leif is working
    // with now, and the person who joined most recently is the one he is
    // still learning. Starting Later is a queue, read from the front.
    //
    // It used to sort Current Clients by expected END date — derived from
    // the calendar, so the list silently reordered itself after a sync,
    // around a projection rather than a fact about the person.
    const screen = await render(buildTestCrm());
    await expect
      .element(screen.getByRole("heading", { name: "Current Clients" }))
      .toBeVisible();

    const page = screen.container.textContent ?? "";
    const current = page.slice(
      page.indexOf("Current Clients"),
      page.indexOf("Starting Later"),
    );
    const later = page.slice(
      page.indexOf("Starting Later"),
      page.indexOf("Upcoming Openings"),
    );

    const order = (section: string, names: string[]) =>
      names.map((name) => section.indexOf(name));
    const ascending = (positions: number[]) =>
      positions.every((n, i) => n >= 0 && (i === 0 || n > positions[i - 1]!));

    // Newest Start Date to oldest, with the name as the tie-break.
    expect(
      ascending(
        order(current, [
          "Gina McNamara", // Sep 16
          "Pete Bassett", // Sep 10
          "Erik Amundson", // Aug 17
          "Sarah Monast", // Aug 17
          "Mackenzie Stabler", // Aug 3
          "Emily Loeb", // Jul 20
          "Adriano Castro", // Jun 14
          "Jules Litman-Cleper", // May 20
        ]),
      ),
    ).toBe(true);

    // And the queue runs the other way: the next to arrive is first.
    expect(
      ascending(
        order(later, [
          "Ava Frotton", // Oct 5
          "Denise Cormier", // Oct 5
          "Daniel Alexander", // Nov 8
          "Emma Wijns", // Nov 8
        ]),
      ),
    ).toBe(true);
  });

  it("never prints the openings answer where a count belongs", async () => {
    // The defect Leif saw in production, and the third place it lived:
    // the page header interpolated the ledger ANSWER into "%{count}
    // openings". Two card call sites were caught by tests; this one was
    // only caught by reading the rendered page.
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("heading", { name: "Upcoming Openings" }))
      .toBeVisible();
    expect(screen.container.textContent).not.toContain("[object Object]");
  });

  it("offers Sync Calendar where the dates come from", async () => {
    const screen = await render(buildTestCrm());

    await expect
      .element(screen.getByRole("button", { name: /Sync Calendar/ }))
      .toBeVisible();
  });

  it("states availability beside the waitlist, and offers no way to act on it", async () => {
    const screen = await render(buildTestCrm());

    // Somebody starting TODAY could be scheduled — thirteen eligible
    // weeks still remain, so their twelve exist. There is simply no room.
    // "Full" is the right answer here, and it is a different answer from
    // the months below, where the calendar runs out first.
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
    // to live only in the page header, four sections above the list.
    const screen = await render(buildTestCrm());

    const button = screen.getByRole("button", { name: "Add to Waitlist" });
    await expect.element(button).toBeVisible();

    const buttonEl = await button.element();
    expect(buttonEl.closest("div")?.parentElement?.textContent).toContain(
      "Waitlist",
    );
  });
});
