import { describe, expect, test } from "vitest";

import {
  buildSlotEvents,
  computeLedger,
  occupancyOn,
  peakOccupancyBetween,
  safeOpeningsStartingOn,
} from "./occupancyLedger";
import { computeExpectedEnd } from "./sessionWeeks";
import type { SlotHolder } from "./slotHolder";
import { weeklyCalendar } from "./testCalendar";

const TODAY = "2026-09-21";
// Plenty of weeks, so the calendar is never the limiting factor unless a
// test makes it one.
const CALENDAR = weeklyCalendar("2026-09-07", 60);

const holder = (
  name: string,
  startDate: string | null,
  extensions = 0,
): SlotHolder => ({
  enrollmentId: name,
  contactId: name,
  name,
  status: "active",
  startDate,
  startWeekConfirmed: true,
  startDateSource: startDate ? "owner" : null,
  end: computeExpectedEnd(CALENDAR, startDate, extensions),
  extensions,
  unresolvedCadenceWeeks: 0,
});

describe("building the event list", () => {
  test("an occupied container contributes only its departure", () => {
    // It is already inside the occupancy count, so adding an arrival
    // would count it twice.
    const events = buildSlotEvents([holder("A", "2026-09-07")], [], TODAY);
    expect(events.map((e) => e.kind)).toEqual(["end"]);
  });

  test("a committed container contributes BOTH its arrival and its departure", () => {
    // The bug. A future start used to be a permanent +1: capacity it took
    // on its Start Date and never gave back, so every month after it was
    // one short.
    const events = buildSlotEvents([], [holder("B", "2026-10-12")], TODAY);
    expect(events.map((e) => [e.date, e.kind])).toEqual([
      ["2026-10-12", "start"],
      // Twelve eligible weeks from the week of 12 October.
      ["2027-01-02", "end"],
    ]);
  });

  test("a container whose end cannot be computed never releases its slot", () => {
    // Which is exactly what not knowing implies. Covers a missing Start
    // Date and a calendar that stops too early alike.
    const noStart = buildSlotEvents([holder("Unknown", null)], [], TODAY);
    expect(noStart).toEqual([]);

    const short: SlotHolder = {
      ...holder("Short calendar", "2026-09-07"),
      end: computeExpectedEnd(weeklyCalendar("2026-09-07", 8), "2026-09-07"),
    };
    expect(buildSlotEvents([short], [], TODAY)).toEqual([]);
  });

  test("departures are applied before arrivals on the same date", () => {
    // A handover, not a moment holding one extra person.
    const leaving = holder("Leaving", "2026-09-07");
    const freesOn =
      leaving.end?.status === "known" ? leaving.end.freesOn : "2026-11-28";
    const events = buildSlotEvents(
      [leaving],
      [holder("Arriving", freesOn)],
      TODAY,
    );
    expect(events.slice(0, 2).map((e) => e.kind)).toEqual(["end", "start"]);

    const ledger = computeLedger(events, 12, 12);
    expect(ledger[0]!.occupiedAfter).toBe(11);
    expect(ledger[1]!.occupiedAfter).toBe(12);
    expect(ledger[1]!.overCapacityAfter).toBe(0);
  });
});

describe("occupancy over time", () => {
  const a = holder("A", "2026-09-07");
  const b = holder("B", "2026-09-14");
  const events = buildSlotEvents([a, b], [holder("C", "2027-01-04")], TODAY);

  test("counts everyone whose event has happened by that date", () => {
    expect(occupancyOn(events, 2, "2026-10-01")).toBe(2);
    expect(occupancyOn(events, 2, "2026-11-28")).toBe(1);
    expect(occupancyOn(events, 2, "2026-12-06")).toBe(0);
    expect(occupancyOn(events, 2, "2027-01-04")).toBe(1);
  });

  test("the peak is the highest point in the window, not its endpoints", () => {
    expect(peakOccupancyBetween(events, 2, "2026-10-01", "2027-01-31")).toBe(2);
    expect(peakOccupancyBetween(events, 2, "2026-12-06", "2027-01-31")).toBe(1);
  });
});

describe("what counts as an opening", () => {
  test("a slot swallowed before the new client finishes is not one", () => {
    // Eleven in the programme and one arriving next month. A twelfth
    // could start today — and would be the thirteenth in October.
    const occupied = Array.from({ length: 11 }, (_, i) =>
      holder(`current ${i}`, "2026-09-07"),
    );
    const events = buildSlotEvents(
      occupied,
      [holder("booked", "2026-10-12")],
      TODAY,
    );
    expect(
      safeOpeningsStartingOn(events, 11, 12, TODAY, CALENDAR),
    ).toMatchObject({ status: "known", openings: 0 });
  });

  test("the same slot IS an opening once the arrival is beyond the new container", () => {
    const occupied = Array.from({ length: 11 }, (_, i) =>
      holder(`current ${i}`, "2026-09-07"),
    );
    const events = buildSlotEvents(
      occupied,
      [holder("booked", "2027-06-07")],
      TODAY,
    );
    expect(
      safeOpeningsStartingOn(events, 11, 12, TODAY, CALENDAR),
    ).toMatchObject({ status: "known", openings: 1 });
  });

  test("an empty practice can take the whole ceiling", () => {
    expect(safeOpeningsStartingOn([], 0, 12, TODAY, CALENDAR)).toMatchObject({
      status: "known",
      openings: 12,
    });
  });

  test("never negative — an over-capacity practice has no openings, it has a problem", () => {
    const occupied = Array.from({ length: 15 }, (_, i) =>
      holder(`current ${i}`, "2026-09-07"),
    );
    const events = buildSlotEvents(occupied, [], TODAY);
    expect(
      safeOpeningsStartingOn(events, 15, 12, TODAY, CALENDAR),
    ).toMatchObject({ status: "known", openings: 0 });
  });

  test("a calendar too short to seat the new client answers UNKNOWN, never zero", () => {
    // The half a headroom-only calculation misses. An empty practice
    // still cannot take anybody if their twelfth session week does not
    // exist.
    expect(
      safeOpeningsStartingOn([], 0, 12, TODAY, weeklyCalendar("2026-09-21", 9)),
    ).toEqual({
      status: "unknown",
      reason: "calendar_too_short",
      weeksScheduled: 9,
      weeksRequired: 12,
    });
  });
});
