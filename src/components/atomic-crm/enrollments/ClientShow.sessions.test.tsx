import { addDays } from "date-fns/addDays";
import { subDays } from "date-fns/subDays";
import { describe, expect, it } from "vitest";
import { render } from "vitest-browser-react";
import { page, userEvent } from "vitest/browser";
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
  ClientSession,
  Deal,
  Enrollment,
  EnrollmentExpectedSession,
  Offer,
} from "@/components/atomic-crm/types";

// Client + Session Operations, ClientShow UX correction: a concise
// summary ("2 of 3 sessions this period" / "Next: ...") instead of a full
// ledger, an Attention section that appears ONLY when something needs
// Leif's judgment, plain-language current-period rows ("Upcoming" / "No
// session booked", never "Fulfilled"/"Pending"/"Unresolved"), and the
// full multi-month history collapsed behind a disclosure by default.
// Service Period model correction: the current period is read directly
// off the Enrollment's own frozen enrollment_expected_sessions slots
// (ordinal 1-3 = Service Period 1), never a calendar-month filter — this
// fixture seeds those slots directly, bypassing the assignment pass
// entirely (that pass is its own, separately-tested Deno-side unit).
//
// Dates below are computed relative to the REAL current time rather than
// hardcoded — this app's own vi.setSystemTime() attempts in a rendered
// (real-browser) test previously hung (see Dashboard.comingUp.test.tsx's
// own comment), so "now" is never faked here.
const leOffer: Offer = {
  id: 1,
  name: "The Living Example",
  type: "individual",
  duration: "4 months",
  current_price: 4000,
  is_active: true,
  client_session_acuity_appointment_type_id: "90522599",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const wonDeal: Deal = {
  id: 1,
  name: "Ada Lovelace",
  contact_id: 1,
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
};

const activeEnrollment: Enrollment = {
  id: 1,
  opportunity_id: 1,
  status: "active",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
};

const toDateOnly = (date: Date) => date.toISOString().slice(0, 10);

// Slot 1 (ordinal 1, Service Period 1): already closed, fulfilled by a
// real past session.
const slot1Start = subDays(new Date(), 10);
const slot1End = subDays(new Date(), 6);
const sessionAScheduledAt = subDays(new Date(), 8).toISOString();

// Slot 2 (ordinal 2, same Service Period 1): still in the future — must
// read as "Upcoming", never flagged, regardless of having no session yet.
const slot2Start = addDays(new Date(), 3);
const slot2End = addDays(new Date(), 7);

const buildSlot = (
  overrides: Partial<EnrollmentExpectedSession>,
): EnrollmentExpectedSession => ({
  id: overrides.id ?? 1,
  enrollment_id: 1,
  source_window_id: overrides.id ?? 1,
  ordinal: 1,
  raw_title: "1:1s",
  window_start: toDateOnly(slot1Start),
  window_end: toDateOnly(slot1End),
  created_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildSession = (overrides: Partial<ClientSession>): ClientSession => ({
  id: overrides.id ?? 1,
  contact_id: 1,
  enrollment_id: 1,
  offer_id: 1,
  status: "booked",
  scheduled_at: sessionAScheduledAt,
  reschedule_count: 0,
  source: "manual",
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildTestCrm = ({
  sessions,
  slots,
  issues = [],
}: {
  sessions: ClientSession[];
  slots: EnrollmentExpectedSession[];
  issues?: Record<string, unknown>[];
}) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      offers: [leOffer],
      deals: [wonDeal],
      enrollments: [activeEnrollment],
      client_sessions: sessions,
      client_session_events: [],
      enrollment_expected_sessions: slots,
      client_session_cadence_issues: issues,
      tasks: [],
    } as any),
    silent: true,
  });
  return {
    dataProvider,
    element: (
      <MemoryRouter initialEntries={["/enrollments/1/show"]}>
        <CRM
          dataProvider={dataProvider}
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
      </MemoryRouter>
    ),
  };
};

describe("ClientShow — Sessions (ClientShow UX correction)", () => {
  it("shows a concise summary, plain-language current-period rows, and keeps history collapsed by default", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      sessions: [buildSession({ id: 1, scheduled_at: sessionAScheduledAt })],
      slots: [
        buildSlot({
          id: 1,
          ordinal: 1,
          window_start: toDateOnly(slot1Start),
          window_end: toDateOnly(slot1End),
        }),
        buildSlot({
          id: 2,
          ordinal: 2,
          window_start: toDateOnly(slot2Start),
          window_end: toDateOnly(slot2End),
        }),
      ],
    });
    const screen = await render(element);

    // Concise summary — never "X of Y weeks fulfilled".
    await expect
      .element(screen.getByText("1 of 2 sessions this period"))
      .toBeInTheDocument();
    // No future session is booked here (slot 2 is still empty) — the
    // summary says so plainly rather than a stale/blank "Next:" line.
    await expect
      .element(screen.getByText("No session booked"))
      .toBeInTheDocument();

    // Plain-language current-period rows — never database-ish status
    // words.
    await expect.element(screen.getByText("Upcoming")).toBeInTheDocument();
    await expect.element(screen.getByText("Fulfilled")).not.toBeInTheDocument();
    await expect.element(screen.getByText("Pending")).not.toBeInTheDocument();

    // Nothing needs Leif's judgment here — no Attention section at all.
    await expect
      .element(screen.getByText("Needs attention"))
      .not.toBeInTheDocument();

    // History exists but is collapsed — its own session timestamp text
    // is not in the accessibility tree until the disclosure is opened.
    await expect.element(screen.getByText("History")).toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "No-show" }))
      .not.toBeInTheDocument();

    await screen.getByText("History").click();
    await expect
      .element(screen.getByRole("button", { name: "No-show" }))
      .toBeInTheDocument();
  });

  it("marking a fulfilling session No-show creates an actionable Needs attention item; Undo No-show clears it — with no sales-pipeline change", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, element } = buildTestCrm({
      sessions: [buildSession({ id: 1, scheduled_at: sessionAScheduledAt })],
      slots: [
        buildSlot({
          id: 1,
          ordinal: 1,
          window_start: toDateOnly(slot1Start),
          window_end: toDateOnly(slot1End),
        }),
      ],
    });
    const screen = await render(element);

    await expect
      .element(screen.getByText("1 of 1 sessions this period"))
      .toBeInTheDocument();

    await screen.getByText("History").click();
    await screen.getByRole("button", { name: "No-show" }).click();

    // The exception is immediately visible AND actionable — never an
    // inert "unresolved" with nothing to click.
    await expect
      .element(screen.getByText("0 of 1 sessions this period"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Needs attention"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByRole("button", { name: "Resolve" }))
      .toBeInTheDocument();

    const { data: dealAfterNoShow } = await dataProvider.getOne<Deal>("deals", {
      id: 1,
    });
    expect(dealAfterNoShow.stage).toBe("won");

    await screen.getByRole("button", { name: "Undo No-show" }).click();

    await expect
      .element(screen.getByText("1 of 1 sessions this period"))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Needs attention"))
      .not.toBeInTheDocument();

    const { data: dealAfterUndo } = await dataProvider.getOne<Deal>("deals", {
      id: 1,
    });
    expect(dealAfterUndo.stage).toBe("won");
  });

  it("Resolve opens a modal over ClientShow (never a separate page) — classify, change classification, then clear the decision, all without leaving the page", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, element } = buildTestCrm({
      sessions: [],
      slots: [
        buildSlot({
          id: 1,
          ordinal: 1,
          window_start: toDateOnly(slot1Start),
          window_end: toDateOnly(slot1End),
        }),
      ],
      // Seeded directly, exactly what the calendar sync's own detection
      // pass would have created for this closed, empty slot.
      issues: [
        {
          id: 1,
          enrollment_id: 1,
          enrollment_expected_session_id: 1,
          classification: null,
          note: null,
          resolved_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    // Nothing fulfilled it — an unresolved cadence issue already exists
    // for this closed slot (the same detection the calendar sync would
    // produce), so Needs attention is showing from the start.
    await expect
      .element(screen.getByText("Needs attention"))
      .toBeInTheDocument();

    await screen.getByRole("button", { name: "Resolve" }).click();

    // A modal, not a navigation.
    await expect
      .element(screen.getByText("What happened this week?"))
      .toBeInTheDocument();

    await screen.getByRole("button", { name: "Known skip" }).click();
    await expect
      .element(screen.getByText("Currently: Known skip"))
      .toBeInTheDocument();

    // Still open — Leif can change his mind right here, no need to
    // reopen anything.
    await screen.getByRole("button", { name: "Rescheduled" }).click();
    await expect
      .element(screen.getByText("Currently: Rescheduled"))
      .toBeInTheDocument();

    const { data: issueAfterReclassify } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issueAfterReclassify.classification).toBe("rescheduled");

    // Close via X — lands back on the exact same ClientShow, not a
    // separate route.
    await screen.getByRole("button", { name: "Close" }).click();
    await expect
      .element(screen.getByText("What happened this week?"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("link", { name: "Ada Lovelace" }))
      .toBeInTheDocument();
    await expect
      .element(screen.getByText("Needs attention"))
      .not.toBeInTheDocument();

    // Reopen the modal and clear the decision entirely.
    await screen.getByRole("button", { name: "Resolve" }).click();
    await expect
      .element(screen.getByText("Currently: Rescheduled"))
      .toBeInTheDocument();
    await screen.getByRole("button", { name: "Clear decision" }).click();

    // Cleared — poll the durable record directly rather than a DOM
    // assertion here: Radix's own close/open exit-animation can leave a
    // brief animating-out duplicate dialog node behind in this headless
    // test environment, which both positive and negative text/placeholder
    // queries can flakily resolve against — the classify/reclassify steps
    // above already directly prove the DOM reflects state correctly.
    await expect
      .poll(async () => {
        const { data } = await dataProvider.getOne(
          "client_session_cadence_issues",
          { id: 1 },
        );
        return data.classification;
      })
      .toBeNull();

    const { data: issueAfterClear } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issueAfterClear.classification).toBeNull();
    expect(issueAfterClear.resolved_at).toBeNull();
  });

  it("Escape closes the modal — same as X, lands back on ClientShow with no navigation", async () => {
    await page.viewport(1280, 900);
    const { element } = buildTestCrm({
      sessions: [],
      slots: [
        buildSlot({
          id: 1,
          ordinal: 1,
          window_start: toDateOnly(slot1Start),
          window_end: toDateOnly(slot1End),
        }),
      ],
      issues: [
        {
          id: 1,
          enrollment_id: 1,
          enrollment_expected_session_id: 1,
          classification: null,
          note: null,
          resolved_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    await screen.getByRole("button", { name: "Resolve" }).click();
    await expect
      .element(screen.getByText("What happened this week?"))
      .toBeInTheDocument();

    await userEvent.keyboard("{Escape}");

    await expect
      .element(screen.getByText("What happened this week?"))
      .not.toBeInTheDocument();
    await expect
      .element(screen.getByRole("link", { name: "Ada Lovelace" }))
      .toBeInTheDocument();
  });

  it("classify, clear, then classify again produces a coherent final state and a complete audit trail — no duplicate/lost events from the round trip", async () => {
    await page.viewport(1280, 900);
    const { dataProvider, element } = buildTestCrm({
      sessions: [],
      slots: [
        buildSlot({
          id: 1,
          ordinal: 1,
          window_start: toDateOnly(slot1Start),
          window_end: toDateOnly(slot1End),
        }),
      ],
      issues: [
        {
          id: 1,
          enrollment_id: 1,
          enrollment_expected_session_id: 1,
          classification: null,
          note: null,
          resolved_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });
    const screen = await render(element);

    await screen.getByRole("button", { name: "Resolve" }).click();
    await screen.getByRole("button", { name: "Known skip" }).click();
    await expect
      .element(screen.getByText("Currently: Known skip"))
      .toBeInTheDocument();

    await screen.getByRole("button", { name: "Clear decision" }).click();
    await expect
      .poll(async () => {
        const { data } = await dataProvider.getOne(
          "client_session_cadence_issues",
          { id: 1 },
        );
        return data.classification;
      })
      .toBeNull();

    // Re-classify from scratch after clearing.
    await screen.getByRole("button", { name: "Missed / ghosted" }).click();
    await expect
      .element(screen.getByText("Currently: Missed / ghosted"))
      .toBeInTheDocument();

    const { data: finalIssue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(finalIssue.classification).toBe("missed_ghosted");
    expect(finalIssue.resolved_at).toBeTruthy();

    const { data: events } = await dataProvider.getList(
      "client_session_cadence_issue_events",
      {
        filter: { cadence_issue_id: 1 },
        pagination: { page: 1, perPage: 20 },
        sort: { field: "id", order: "ASC" },
      },
    );
    // resolved (known_skip) -> reopened -> resolved (missed_ghosted) —
    // every transition durably logged, nothing skipped or duplicated.
    expect(events.map((event) => event.kind)).toEqual([
      "resolved",
      "reopened",
      "resolved",
    ]);
  });
});
