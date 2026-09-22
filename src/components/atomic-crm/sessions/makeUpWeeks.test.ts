import { describe, expect, test } from "vitest";

import {
  computeExpectedEnd,
  eligibleWeeksFrom,
} from "../capacity/sessionWeeks";
import { weeklyCalendar } from "../capacity/testCalendar";
import { computeClientSessionCadenceSummary } from "./computeClientSessionCadenceSummary";
import type {
  ClientSession,
  ClientSessionCadenceIssue,
  EnrollmentExpectedSession,
} from "../types";

// Year Tracking is a plan. It is not a log of where sessions happened.
//
// Leif was ill the week before 30 August and moved five client sessions
// into 30 Aug – 2 Sep. That week was never a 1:1 week, and it must not
// become one: if a make-up week counted as an entitlement week, every
// client he moved would silently gain a session they were not owed, and
// the empty original week — which IS a cross-week reschedule — would stop
// looking like one.
//
// So three things have to stay true at once, and they pull in different
// directions:
//
//   the original week stays eligible and empty       -> needs review
//   the make-up week never becomes eligible          -> not a session week
//   the make-up session is real and stays visible    -> evidence
//
// Only Leif can say which of skip / no-show / reschedule the empty week
// was. Everything here stops one step short of that.

const NOW = new Date("2026-09-22T12:00:00Z");

// Weeks of 23 Aug and 13 Sep are planned 1:1 weeks. The week of 30 Aug is
// NOT — that is the week Leif was ill and moved people into.
const CALENDAR = weeklyCalendar("2026-06-07", 20, ["2026-08-30"]);

const slot = (
  id: number,
  ordinal: number,
  start: string,
  end: string,
): EnrollmentExpectedSession => ({
  id,
  enrollment_id: 1,
  source_window_id: id,
  ordinal,
  window_start: start,
  window_end: end,
  raw_title: "1:1s",
  created_at: "2026-06-01T00:00:00.000Z",
});

const session = (id: number, at: string): ClientSession => ({
  id,
  contact_id: 1,
  enrollment_id: 1,
  offer_id: 1,
  status: "completed",
  scheduled_at: `${at}T16:00:00.000Z`,
  reschedule_count: 0,
  last_rescheduled_at: null,
  cancelled_at: null,
  no_show_at: null,
  source: "acuity",
  acuity_appointment_id: String(id),
  acuity_appointment_type_id: "90522599",
  created_at: "2026-06-01T00:00:00.000Z",
  updated_at: "2026-06-01T00:00:00.000Z",
});

const unresolvedIssue = (slotId: number): ClientSessionCadenceIssue => ({
  id: slotId,
  enrollment_id: 1,
  enrollment_expected_session_id: slotId,
  classification: null,
  note: null,
  resolved_at: null,
  created_at: "2026-09-01T00:00:00.000Z",
  updated_at: "2026-09-01T00:00:00.000Z",
});

describe("a make-up week is not an entitlement week", () => {
  test("a week with no `1:1s` event never becomes an eligible session week", () => {
    // The whole invariant in one line: eligibility is read off the
    // calendar and nothing else. A session in the week of 30 August
    // cannot put that week into this list, because this list never looks
    // at sessions.
    const eligible = eligibleWeeksFrom(CALENDAR, "2026-08-01");
    expect(eligible.map((week) => week.start)).not.toContain("2026-08-30");
    expect(eligible.map((week) => week.start)).toContain("2026-08-23");
  });

  test("the original week is still owed, and the make-up session is evidence for it", () => {
    // Week of 23 Aug: planned, and empty. Week of 30 Aug: a real session,
    // in a week that is not part of anybody's twelve.
    const slots = [
      slot(1, 1, "2026-08-16", "2026-08-21"),
      slot(2, 2, "2026-08-23", "2026-08-28"),
      slot(3, 3, "2026-09-13", "2026-09-18"),
    ];
    const summary = computeClientSessionCadenceSummary(
      {
        slots,
        sessions: [session(10, "2026-08-17"), session(11, "2026-08-31")],
        issues: [unresolvedIssue(2)],
      },
      NOW,
    );

    const emptyWeek = summary.allWeeks.find((week) => week.slot.id === 2)!;
    // Still needing a decision — NOT classified by the CRM.
    expect(emptyWeek.status).toBe("unresolved");
    // And the appointment that probably explains it, on that row.
    expect(emptyWeek.evidence?.id).toBe(11);

    // The make-up session did not fulfil any week.
    expect(
      summary.allWeeks.filter((week) => week.status === "fulfilled").length,
    ).toBe(1);
  });

  test("evidence is never mistaken for an answer", () => {
    const slots = [slot(2, 1, "2026-08-23", "2026-08-28")];
    const summary = computeClientSessionCadenceSummary(
      { slots, sessions: [session(11, "2026-08-31")], issues: [] },
      NOW,
    );
    const week = summary.allWeeks[0]!;
    expect(week.evidence?.id).toBe(11);
    // Evidence present, decision absent: the week is still outstanding
    // and carries no classification.
    expect(week.status).toBe("unresolved");
    expect(week.issue?.classification ?? null).toBeNull();
  });

  test("one appointment is evidence for at most one week", () => {
    // Two empty weeks and one stray session must not read as two
    // reschedules. Proximity is not proof, and double-counting it would
    // invent an entitlement.
    const slots = [
      slot(1, 1, "2026-08-16", "2026-08-21"),
      slot(2, 2, "2026-08-23", "2026-08-28"),
    ];
    const summary = computeClientSessionCadenceSummary(
      {
        slots,
        sessions: [session(11, "2026-08-31")],
        issues: [unresolvedIssue(1), unresolvedIssue(2)],
      },
      NOW,
    );
    const withEvidence = summary.allWeeks.filter((week) => week.evidence);
    expect(withEvidence).toHaveLength(1);
    // The earlier week claims it; the later one is left plainly empty.
    expect(withEvidence[0]!.slot.id).toBe(1);
  });

  test("classifying it Rescheduled buys exactly one more eligible week", () => {
    // And a skip buys none. This is the whole operational consequence of
    // the decision Leif is being asked for.
    const start = "2026-06-14";
    const asIs = computeExpectedEnd(CALENDAR, start, 0)!;
    const rescheduled = computeExpectedEnd(CALENDAR, start, 1)!;
    const skipped = computeExpectedEnd(CALENDAR, start, 0)!;

    expect(asIs.status).toBe("known");
    expect(rescheduled.status).toBe("known");
    if (asIs.status !== "known" || rescheduled.status !== "known") {
      throw new Error("unreachable");
    }

    const eligible = eligibleWeeksFrom(CALENDAR, start);
    const asIsIndex = eligible.findIndex(
      (week) => week.start === asIs.finalWeek.start,
    );
    const rescheduledIndex = eligible.findIndex(
      (week) => week.start === rescheduled.finalWeek.start,
    );
    expect(rescheduledIndex - asIsIndex).toBe(1);
    expect(skipped.status === "known" && skipped.finalWeek.start).toBe(
      asIs.finalWeek.start,
    );

    // And the week it gains is a PLANNED week, never the make-up week.
    expect(rescheduled.finalWeek.start).not.toBe("2026-08-30");
  });

  test("the twelve-week view counts settled weeks, not attended ones", () => {
    // A week Leif classified as a known skip is accounted for. It is not
    // attended and it never will be, and that is a complete answer.
    const slots = [
      slot(1, 1, "2026-08-16", "2026-08-21"),
      slot(2, 2, "2026-08-23", "2026-08-28"),
      slot(3, 3, "2026-09-13", "2026-09-18"),
    ];
    const summary = computeClientSessionCadenceSummary(
      {
        slots,
        sessions: [session(10, "2026-08-17")],
        issues: [
          {
            ...unresolvedIssue(2),
            classification: "known_skip",
            resolved_at: "2026-09-01T00:00:00.000Z",
          },
          unresolvedIssue(3),
        ],
      },
      NOW,
    );

    expect(summary.totalCount).toBe(3);
    // Fulfilled + classified.
    expect(summary.accountedCount).toBe(2);
    expect(summary.needsReviewCount).toBe(1);
  });
});
