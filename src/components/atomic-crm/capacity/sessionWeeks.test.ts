import { describe, expect, test } from "vitest";

import {
  computeExpectedEnd,
  crossWeekReschedules,
  eligibleWeeksFrom,
} from "./sessionWeeks";
import { weeklyCalendar } from "./testCalendar";

// Twelve weekly `1:1s` weeks from Monday 2026-09-07.
const TWELVE = weeklyCalendar("2026-09-07", 12);
// The same, with the weeks of 5 and 12 October closed — travel, a holiday,
// anything. They are simply not in the calendar.
const WITH_CLOSED_WEEKS = weeklyCalendar("2026-09-07", 12, [
  "2026-10-05",
  "2026-10-12",
]);

describe("Session Week #1", () => {
  test("is the `1:1s` week the Start Date falls in", () => {
    // Leif sets a Start Date inside the week he means. Requiring the week
    // to begin on or after it silently skips a week whenever he picks any
    // day but the Monday — which is what was happening to Gina, Ava and
    // Denise on the real calendar.
    const [first] = eligibleWeeksFrom(TWELVE, "2026-09-09");
    expect(first!.start).toBe("2026-09-07");
  });

  test("is the next `1:1s` week when the Start Date falls in a closed one", () => {
    const [first] = eligibleWeeksFrom(WITH_CLOSED_WEEKS, "2026-10-07");
    expect(first!.start).toBe("2026-10-19");
  });

  test("is the week itself when the Start Date is its Monday", () => {
    const [first] = eligibleWeeksFrom(TWELVE, "2026-09-07");
    expect(first!.start).toBe("2026-09-07");
  });

  test("a week that ended before the Start Date is never eligible", () => {
    const eligible = eligibleWeeksFrom(TWELVE, "2026-09-14");
    expect(eligible[0]!.start).toBe("2026-09-14");
    expect(eligible).toHaveLength(11);
  });
});

describe("the twelfth eligible week ends the container", () => {
  test("twelve available weeks produce the expected end", () => {
    const end = computeExpectedEnd(TWELVE, "2026-09-07")!;
    expect(end.status).toBe("known");
    if (end.status !== "known") throw new Error("unreachable");
    // Twelve consecutive weeks from 7 September: the twelfth starts on
    // 23 November and runs to the Friday.
    expect(end.finalWeek.start).toBe("2026-11-23");
    expect(end.lastDay).toBe("2026-11-27");
    // The slot is free again the day the week's exclusive end falls on.
    expect(end.freesOn).toBe("2026-11-28");
    expect(end.weeksRequired).toBe(12);
  });

  test("closed weeks do not count, so the end moves later", () => {
    // Same twelve sessions, two closed weeks in the middle: the container
    // runs two weeks longer in wall-clock time and not one session more.
    const end = computeExpectedEnd(WITH_CLOSED_WEEKS, "2026-09-07")!;
    if (end.status !== "known") throw new Error("unreachable");
    expect(end.finalWeek.start).toBe("2026-12-07");
  });

  test("a long gap in the calendar is not a shortened container", () => {
    // The real Living Example calendar has no `1:1s` weeks at all between
    // 2 July and 13 September 2026. Four calendar months would have ended
    // these containers in the middle of a summer with no sessions in it.
    const summer = [
      ...weeklyCalendar("2026-06-01", 3),
      ...weeklyCalendar("2026-09-07", 12),
    ];
    const end = computeExpectedEnd(summer, "2026-06-01")!;
    if (end.status !== "known") throw new Error("unreachable");
    // Three weeks in June, then the ninth of the autumn weeks.
    expect(end.finalWeek.start).toBe("2026-11-02");
  });

  test("no Start Date means no end, rather than a guess", () => {
    expect(computeExpectedEnd(TWELVE, null)).toBeNull();
  });
});

describe("an incomplete calendar is an answer, not a date", () => {
  test("fewer than twelve eligible weeks reports how many exist", () => {
    const end = computeExpectedEnd(
      weeklyCalendar("2026-09-07", 8),
      "2026-09-07",
    )!;
    expect(end).toMatchObject({
      status: "incomplete",
      weeksScheduled: 8,
      weeksRequired: 12,
    });
    if (end.status !== "incomplete") throw new Error("unreachable");
    expect(end.lastKnownWeek!.start).toBe("2026-10-26");
  });

  test("extending the calendar turns an unknown end into a known one", () => {
    // Exactly what Sync Calendar is for: the same client, the same Start
    // Date, four more `1:1s` weeks marked in Year Tracking.
    const before = computeExpectedEnd(
      weeklyCalendar("2026-09-07", 8),
      "2026-09-07",
    )!;
    expect(before.status).toBe("incomplete");

    const after = computeExpectedEnd(
      weeklyCalendar("2026-09-07", 12),
      "2026-09-07",
    )!;
    expect(after.status).toBe("known");
    if (after.status !== "known") throw new Error("unreachable");
    expect(after.finalWeek.start).toBe("2026-11-23");
  });

  test("a container one week short is still incomplete, not rounded down", () => {
    const end = computeExpectedEnd(
      weeklyCalendar("2026-09-07", 11),
      "2026-09-07",
    )!;
    expect(end).toMatchObject({ status: "incomplete", weeksScheduled: 11 });
  });
});

describe("a cross-week reschedule adds exactly one eligible week", () => {
  test("one reschedule needs a thirteenth week", () => {
    const thirteen = weeklyCalendar("2026-09-07", 13);
    const base = computeExpectedEnd(thirteen, "2026-09-07", 0)!;
    const extended = computeExpectedEnd(thirteen, "2026-09-07", 1)!;
    if (base.status !== "known" || extended.status !== "known") {
      throw new Error("unreachable");
    }
    expect(base.finalWeek.start).toBe("2026-11-23");
    expect(extended.finalWeek.start).toBe("2026-11-30");
    expect(extended.weeksRequired).toBe(13);
  });

  test("two reschedules add exactly two weeks", () => {
    const end = computeExpectedEnd(
      weeklyCalendar("2026-09-07", 14),
      "2026-09-07",
      2,
    )!;
    if (end.status !== "known") throw new Error("unreachable");
    expect(end.finalWeek.start).toBe("2026-12-07");
    expect(end.weeksRequired).toBe(14);
  });

  test("an extension the calendar cannot reach is incomplete, not silently dropped", () => {
    // Twelve weeks exist and the container now needs thirteen.
    const end = computeExpectedEnd(TWELVE, "2026-09-07", 1)!;
    expect(end).toMatchObject({
      status: "incomplete",
      weeksScheduled: 12,
      weeksRequired: 13,
      extensions: 1,
    });
  });
});

describe("what counts as a cross-week reschedule", () => {
  // A cadence issue is raised per (Enrollment, assigned week) only when
  // that week closed with NO session scheduled inside it. So a session
  // moved to another time or day of the SAME week never raises one, and a
  // session moved into a later week always does. 'rescheduled' is
  // therefore cross-week by construction — nothing needs to parse an
  // Acuity reschedule counter, which would have counted same-week changes
  // too.
  test("only a 'rescheduled' classification extends a container", () => {
    expect(crossWeekReschedules(["rescheduled"])).toBe(1);
    expect(crossWeekReschedules(["rescheduled", "rescheduled"])).toBe(2);
  });

  test("a skipped week does not extend", () => {
    expect(crossWeekReschedules(["known_skip"])).toBe(0);
  });

  test("a no-show or ghosted session does not extend", () => {
    // The session is forfeited under the no-rollover rule. An exception is
    // Leif's to make, not the CRM's to assume.
    expect(crossWeekReschedules(["missed_ghosted"])).toBe(0);
  });

  test("an unclassified issue does not extend — Leif has not said yet", () => {
    expect(crossWeekReschedules([null])).toBe(0);
  });

  test("a same-week change produces no issue at all, so nothing to count", () => {
    expect(crossWeekReschedules([])).toBe(0);
  });

  test("a mixture counts only the reschedules", () => {
    expect(
      crossWeekReschedules([
        "known_skip",
        "rescheduled",
        "missed_ghosted",
        null,
        "rescheduled",
      ]),
    ).toBe(2);
  });
});

describe("a booking never moves a Start Date", () => {
  // There is nothing to test in this module about Acuity, and that is the
  // point: computeExpectedEnd takes a Start Date and a calendar, and no
  // session or appointment is an input to it at all. A client may book
  // Session #1 weeks early or weeks late; the container is unchanged.
  test("the same Start Date yields the same end whatever was booked", () => {
    const end = computeExpectedEnd(TWELVE, "2026-09-09")!;
    if (end.status !== "known") throw new Error("unreachable");
    expect(end.finalWeek.start).toBe("2026-11-23");
  });
});
