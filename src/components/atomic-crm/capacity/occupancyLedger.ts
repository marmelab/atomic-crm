import type { SlotHolder } from "./slotHolder";
import { addMonths } from "./projectedEnd";

// How many people are in the programme, at every moment the CRM knows
// about — and from that, the only question Leif actually asks a capacity
// board:
//
//     "When could I safely promise somebody a start?"
//
// The first version of this file answered a different question and did
// not notice. It counted the containers projected to finish in a month,
// subtracted the ones already booked to start in that month, and reported
// the running difference as "openings". Two things were wrong with that,
// and they pointed in opposite directions.
//
// It never gave a committed client their slot BACK. A future start was a
// permanent +1: Denise Cormier starts on 30 September and finishes around
// 30 January, but only currently-occupied containers were scanned for end
// dates, so her own finish was invisible. January read 6 when the ledger
// says 7.
//
// And it called October an opening. One slot does come free on 24 October
// — and on 8 November four people arrive, taking the practice to fifteen.
// A slot that is swallowed before anybody could use it is not an opening.
// Leif filling that "opening" would have made it sixteen.
//
// So occupancy is simulated over time, every known arrival and departure
// in one ledger, and an opening means what it has to mean to be safe:
// somebody could start then AND still be there at the end.

export type SlotEvent = {
  date: string;
  holder: SlotHolder;
  kind: "start" | "end";
};

export type LedgerEntry = SlotEvent & {
  // Occupancy immediately after this event.
  occupiedAfter: number;
  // Ceiling minus occupancy, floored at zero. See `overCapacityAfter` for
  // the other direction — a board that shows "-3 openings" is not saying
  // anything a person can act on.
  remainingAfter: number;
  overCapacityAfter: number;
};

// Same-date ordering: departures are applied before arrivals.
//
// A container ending on the 14th and another starting on the 14th is a
// handover, not a moment when the practice held one extra person. Ordering
// arrivals first would invent a one-day spike and refuse a start that is
// genuinely fine. Nothing in Leif's data collides today; the rule is
// written down so it cannot be decided differently by accident later.
const KIND_ORDER = { end: 0, start: 1 } as const;

const byDateThenKind = (a: SlotEvent, b: SlotEvent): number =>
  a.date.localeCompare(b.date) ||
  KIND_ORDER[a.kind] - KIND_ORDER[b.kind] ||
  a.holder.name.localeCompare(b.holder.name);

// Every future arrival and departure the CRM can derive, in order.
//
// A currently-occupied container contributes only its departure — it is
// already inside the opening count. A committed one contributes both, and
// that symmetry is the bug fix: capacity it takes on its start date, it
// gives back on its end date.
//
// A container with no computable end contributes no departure at all. It
// holds its slot for the whole horizon, which is the honest consequence of
// not knowing when it finishes, and those people are named separately
// rather than quietly excluded.
//
// So does one whose PROJECTION has already run out. Jules Litman-Cleper
// started on 20 May; four months lands on 20 September, and on 21
// September Leif still considers him a current client. A projected end is
// arithmetic, not an event — it is not evidence that anything ended, and
// releasing his slot on it would hand Leif an opening that does not exist.
// A container is retired by a recorded end date or a terminal status, both
// of which are decisions somebody made. Until then it holds its slot and
// is surfaced for Leif.
export const buildSlotEvents = (
  occupied: SlotHolder[],
  committed: SlotHolder[],
  today: string,
): SlotEvent[] => {
  const events: SlotEvent[] = [];

  for (const holder of occupied) {
    if (holder.end.date && holder.end.date >= today) {
      events.push({ date: holder.end.date, holder, kind: "end" });
    }
  }
  for (const holder of committed) {
    if (!holder.startDate) continue;
    events.push({ date: holder.startDate, holder, kind: "start" });
    if (holder.end.date && holder.end.date > holder.startDate) {
      events.push({ date: holder.end.date, holder, kind: "end" });
    }
  }

  return events.sort(byDateThenKind);
};

export const computeLedger = (
  events: SlotEvent[],
  occupiedToday: number,
  max: number,
): LedgerEntry[] => {
  let occupied = occupiedToday;
  return events.map((event) => {
    occupied += event.kind === "start" ? 1 : -1;
    return {
      ...event,
      occupiedAfter: occupied,
      remainingAfter: Math.max(max - occupied, 0),
      overCapacityAfter: Math.max(occupied - max, 0),
    };
  });
};

// Occupancy on a given date, once that date's events have all happened.
export const occupancyOn = (
  events: SlotEvent[],
  occupiedToday: number,
  date: string,
): number =>
  events.reduce(
    (count, event) =>
      event.date <= date ? count + (event.kind === "start" ? 1 : -1) : count,
    occupiedToday,
  );

// The most people in the programme at any moment in [from, to].
//
// Only event dates can change the count, so the candidates are the start
// of the window plus every event inside it.
export const peakOccupancyBetween = (
  events: SlotEvent[],
  occupiedToday: number,
  from: string,
  to: string,
): number => {
  let peak = occupancyOn(events, occupiedToday, from);
  let running = peak;
  for (const event of events) {
    if (event.date <= from) continue;
    if (event.date > to) break;
    running += event.kind === "start" ? 1 : -1;
    if (running > peak) peak = running;
  }
  return peak;
};

// How many NEW clients could start on `date` and stay for the whole
// programme without the practice ever going over its ceiling.
//
// This is the number the word "opening" has to mean. Anything smaller —
// "a slot is free that day", "the month nets out positive" — invites Leif
// to promise a start he will have to take back, which is the one failure a
// capacity board exists to prevent.
//
// An unknown programme length means the window cannot be drawn, so the
// honest answer is the occupancy on the day itself rather than a
// projection over an interval nobody can size.
export const safeOpeningsStartingOn = (
  events: SlotEvent[],
  occupiedToday: number,
  max: number,
  date: string,
  durationMonths: number | null,
): number => {
  const windowEnd =
    durationMonths != null && durationMonths > 0
      ? addMonths(date, durationMonths)
      : date;
  const peak = peakOccupancyBetween(events, occupiedToday, date, windowEnd);
  // A new client is one more person for the whole window, so the ceiling
  // has to hold with them in it.
  return Math.max(max - peak, 0);
};
