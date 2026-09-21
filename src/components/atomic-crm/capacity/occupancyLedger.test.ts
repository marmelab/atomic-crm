import { describe, expect, test } from "vitest";

import type { SlotHolder } from "./slotHolder";
import {
  buildSlotEvents,
  computeLedger,
  occupancyOn,
  peakOccupancyBetween,
  safeOpeningsStartingOn,
} from "./occupancyLedger";

const holder = (
  name: string,
  startDate: string | null,
  endDate: string | null,
): SlotHolder => ({
  enrollmentId: name,
  contactId: name,
  name,
  status: "active",
  startDate,
  startWeekConfirmed: true,
  startDateSource: startDate ? "owner" : null,
  end: endDate
    ? { date: endDate, basis: "projected" }
    : { date: null, basis: "unknown" },
});

const TODAY = "2026-09-21";

describe("building the event list", () => {
  test("an occupied container contributes only its departure", () => {
    // It is already inside the occupancy count, so adding an arrival
    // would count it twice.
    const events = buildSlotEvents(
      [holder("Adriano", "2026-06-14", "2026-10-14")],
      [],
      TODAY,
    );
    expect(events).toEqual([
      expect.objectContaining({ date: "2026-10-14", kind: "end" }),
    ]);
  });

  test("a committed container contributes BOTH its arrival and its departure", () => {
    // The bug. A future start used to be a permanent +1: capacity it took
    // on its start date and never gave back, so every month after it was
    // one short.
    const events = buildSlotEvents(
      [],
      [holder("Denise", "2026-10-05", "2027-02-05")],
      TODAY,
    );
    expect(events.map((event) => [event.date, event.kind])).toEqual([
      ["2026-10-05", "start"],
      ["2027-02-05", "end"],
    ]);
  });

  test("a departure already in the past is not a future event", () => {
    const events = buildSlotEvents(
      [holder("Long gone", "2026-01-01", "2026-05-01")],
      [],
      TODAY,
    );
    expect(events).toEqual([]);
  });

  test("a container with no computable end never releases its slot", () => {
    // Which is exactly what not knowing when somebody finishes implies.
    const events = buildSlotEvents(
      [holder("Unknown", "2026-06-01", null)],
      [],
      TODAY,
    );
    expect(events).toEqual([]);
  });

  test("departures are applied before arrivals on the same date", () => {
    // A handover, not a moment holding one extra person.
    const events = buildSlotEvents(
      [holder("Leaving", "2026-06-01", "2026-10-14")],
      [holder("Arriving", "2026-10-14", "2027-02-14")],
      TODAY,
    );
    expect(events.slice(0, 2).map((event) => event.kind)).toEqual([
      "end",
      "start",
    ]);
    const ledger = computeLedger(events, 12, 12);
    expect(ledger[0]!.occupiedAfter).toBe(11);
    expect(ledger[1]!.occupiedAfter).toBe(12);
    expect(ledger[1]!.overCapacityAfter).toBe(0);
  });
});

describe("occupancy over time", () => {
  const events = buildSlotEvents(
    [
      holder("A", "2026-06-14", "2026-10-14"),
      holder("B", "2026-06-24", "2026-10-24"),
    ],
    [holder("C", "2026-11-08", "2027-03-08")],
    TODAY,
  );

  test("counts everyone whose event has happened by that date", () => {
    expect(occupancyOn(events, 2, "2026-10-01")).toBe(2);
    expect(occupancyOn(events, 2, "2026-10-14")).toBe(1);
    expect(occupancyOn(events, 2, "2026-10-24")).toBe(0);
    expect(occupancyOn(events, 2, "2026-11-08")).toBe(1);
  });

  test("the peak is the highest point in the window, not its endpoints", () => {
    // Between October and December occupancy dips to zero and comes back
    // to one. An endpoint reading would miss the two at the start.
    expect(peakOccupancyBetween(events, 2, "2026-10-01", "2026-12-01")).toBe(2);
    expect(peakOccupancyBetween(events, 2, "2026-10-25", "2026-12-01")).toBe(1);
  });
});

describe("what counts as an opening", () => {
  test("a slot that is swallowed before the new client finishes is not one", () => {
    // Eleven in the programme and one arriving next month. A twelfth
    // could start today — and would be the thirteenth in October.
    const events = buildSlotEvents(
      Array.from({ length: 11 }, (_, i) =>
        holder(`current ${i}`, "2026-09-01", "2027-01-01"),
      ),
      [holder("booked", "2026-10-12", "2027-02-12")],
      TODAY,
    );
    expect(safeOpeningsStartingOn(events, 11, 12, TODAY, 4)).toBe(0);
  });

  test("the same slot IS an opening once the new client would be gone before the arrival", () => {
    const events = buildSlotEvents(
      Array.from({ length: 11 }, (_, i) =>
        holder(`current ${i}`, "2026-09-01", "2027-01-01"),
      ),
      // Far enough out that a client starting today has finished first.
      [holder("booked", "2027-06-01", "2027-10-01")],
      TODAY,
    );
    expect(safeOpeningsStartingOn(events, 11, 12, TODAY, 4)).toBe(1);
  });

  test("an empty practice can take the whole ceiling", () => {
    expect(safeOpeningsStartingOn([], 0, 12, TODAY, 4)).toBe(12);
  });

  test("never negative — an over-capacity practice has no openings, it has a problem", () => {
    const events = buildSlotEvents(
      Array.from({ length: 15 }, (_, i) =>
        holder(`current ${i}`, "2026-09-01", "2027-01-01"),
      ),
      [],
      TODAY,
    );
    expect(safeOpeningsStartingOn(events, 15, 12, TODAY, 4)).toBe(0);
  });

  test("with no programme length, the answer is about the day itself", () => {
    // Nothing can be said about a window whose size nobody knows, so the
    // honest fallback is occupancy on the day rather than a projection
    // over an interval that was invented.
    const events = buildSlotEvents(
      [holder("A", "2026-09-01", "2027-01-01")],
      [holder("B", "2026-10-12", "2027-02-12")],
      TODAY,
    );
    expect(safeOpeningsStartingOn(events, 1, 12, TODAY, null)).toBe(11);
  });
});
