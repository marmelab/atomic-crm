import { describe, expect, test } from "vitest";

import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "./individualCapacity";
import { weeklyCalendar } from "./testCalendar";

const NOW = new Date("2026-09-21T12:00:00Z");
const MAX = 12;

// 40 weeks from Monday 2026-09-07 — enough for several full containers.
const CALENDAR = weeklyCalendar("2026-09-07", 40);

let nextId = 1;
const enrollment = (
  overrides: Partial<SlotEnrollment> = {},
): SlotEnrollment => ({
  id: nextId++,
  status: "active",
  start_date: "2026-09-07",
  end_date: null,
  start_date_source: "owner",
  name: `Client ${nextId}`,
  contactId: nextId,
  ...overrides,
});

describe("which Enrollments consume a slot", () => {
  test("a container that has started and not finished consumes one", () => {
    const capacity = computeIndividualCapacity(
      [enrollment()],
      MAX,
      CALENDAR,
      NOW,
    );
    expect(capacity.active).toBe(1);
  });

  test.each(["completed", "withdrawn", "ended"] as const)(
    "a %s container consumes nothing",
    (status) => {
      const capacity = computeIndividualCapacity(
        [enrollment({ status }), enrollment()],
        MAX,
        CALENDAR,
        NOW,
      );
      expect(capacity.active).toBe(1);
    },
  );

  test("an agreed container that has not started yet is committed, NOT active", () => {
    // The original bug: six people who had agreed to start in October and
    // November were added to the twelve Leif was working with, and the
    // dashboard reported "18 / 12 active".
    const capacity = computeIndividualCapacity(
      [
        ...Array.from({ length: 12 }, () => enrollment()),
        ...Array.from({ length: 6 }, () =>
          enrollment({ start_date: "2026-11-09" }),
        ),
      ],
      MAX,
      CALENDAR,
      NOW,
    );
    expect(capacity.active).toBe(12);
    expect(capacity.committed).toHaveLength(6);
    expect(capacity.overCapacityBy).toBe(0);
  });

  test("a container starting TODAY is active, not committed", () => {
    const capacity = computeIndividualCapacity(
      [enrollment({ start_date: "2026-09-21" })],
      MAX,
      CALENDAR,
      NOW,
    );
    expect(capacity.active).toBe(1);
    expect(capacity.committed).toHaveLength(0);
  });

  test("a live container with no Start Date still counts, and cannot be ended", () => {
    const capacity = computeIndividualCapacity(
      [enrollment({ start_date: null, start_date_source: null })],
      MAX,
      CALENDAR,
      NOW,
    );
    expect(capacity.active).toBe(1);
    expect(capacity.unknownEnd).toHaveLength(1);
    // Not a calendar problem — a missing decision.
    expect(capacity.needsCalendar).toHaveLength(0);
  });
});

describe("over capacity", () => {
  test("never reports negative openings — it reports being over", () => {
    const capacity = computeIndividualCapacity(
      Array.from({ length: 14 }, () => enrollment()),
      MAX,
      CALENDAR,
      NOW,
    );
    expect(capacity.overCapacityBy).toBe(2);
    expect(capacity.openings).toEqual({
      status: "known",
      openings: 0,
      peakOccupancy: 14,
    });
  });

  test("openings is unknown, not zero, when the Offer has no ceiling", () => {
    const capacity = computeIndividualCapacity(
      [enrollment()],
      null,
      CALENDAR,
      NOW,
    );
    expect(capacity.openings).toBeNull();
  });
});

describe("an opening needs room AND a calendar", () => {
  test("an empty practice with a full calendar can take the whole ceiling", () => {
    const capacity = computeIndividualCapacity([], MAX, CALENDAR, NOW);
    expect(capacity.openings).toMatchObject({ status: "known", openings: 12 });
  });

  test("an empty practice with a short calendar can take NOBODY", () => {
    // The half a headroom-only calculation misses entirely. Twelve free
    // slots are worth nothing if the twelfth session week does not exist
    // to put anybody in.
    const capacity = computeIndividualCapacity(
      [],
      MAX,
      weeklyCalendar("2026-09-21", 8),
      NOW,
    );
    expect(capacity.openings).toEqual({
      status: "unknown",
      reason: "calendar_too_short",
      weeksScheduled: 8,
      weeksRequired: 12,
    });
  });

  test("a committed future start is subtracted from today's openings", () => {
    // Nine in the programme, three slots apparently free, four people
    // already booked to arrive. "3 openings" would invite overbooking.
    const capacity = computeIndividualCapacity(
      [
        ...Array.from({ length: 9 }, () => enrollment()),
        ...Array.from({ length: 4 }, () =>
          enrollment({ start_date: "2026-10-12" }),
        ),
      ],
      MAX,
      CALENDAR,
      NOW,
    );
    expect(capacity.active).toBe(9);
    expect(capacity.committed).toHaveLength(4);
    expect(capacity.openings).toMatchObject({ status: "known", openings: 0 });
  });

  test("a month after the departures is an opening; the month of them is not", () => {
    // Twelve containers all end in the week of 23 November. A client
    // started in November overlaps every one of them; a client started
    // in January overlaps only the one person booked to arrive then.
    const capacity = computeIndividualCapacity(
      [
        ...Array.from({ length: 12 }, () =>
          enrollment({ start_date: "2026-09-07" }),
        ),
        enrollment({ start_date: "2027-01-04", name: "Arrives later" }),
      ],
      MAX,
      CALENDAR,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);
    const byMonth = Object.fromEntries(
      months.map((m) => [m.month, m.openings]),
    );

    expect(byMonth["2026-11"]).toMatchObject({ status: "known", openings: 0 });
    expect(byMonth["2027-01"]).toMatchObject({ status: "known", openings: 11 });
  });
});

describe("a committed client gives their slot back", () => {
  test("their start AND their end are both in the ledger", () => {
    // The bug: only occupied containers were scanned for end dates, so a
    // future start was a permanent +1.
    const capacity = computeIndividualCapacity(
      [enrollment({ start_date: "2026-10-12", name: "Later" })],
      MAX,
      CALENDAR,
      NOW,
    );
    const { ledger } = computeFutureOpenings(capacity, NOW);
    expect(ledger.map((entry) => entry.kind)).toEqual(["start", "end"]);
  });

  test("a container whose end cannot be computed never frees its slot", () => {
    const capacity = computeIndividualCapacity(
      [enrollment({ start_date: "2026-10-12" })],
      MAX,
      weeklyCalendar("2026-09-07", 10),
      NOW,
    );
    const { ledger } = computeFutureOpenings(capacity, NOW);
    expect(ledger.map((entry) => entry.kind)).toEqual(["start"]);
    expect(capacity.needsCalendar).toHaveLength(1);
  });
});
