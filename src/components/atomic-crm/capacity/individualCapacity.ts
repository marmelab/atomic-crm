import { projectedEndDate } from "./projectedEnd";
import {
  buildSlotEvents,
  computeLedger,
  occupancyOn,
  safeOpeningsStartingOn,
  type LedgerEntry,
  type SlotEvent,
} from "./occupancyLedger";
import {
  isStartWeekConfirmed,
  type SlotEnrollment,
  type SlotHolder,
} from "./slotHolder";
import { slotPhaseOf, toDateKey } from "./slotOccupancy";

export type { SlotEnrollment, SlotHolder } from "./slotHolder";

export type IndividualCapacity = {
  max: number | null;
  // People in the programme today.
  active: number;
  // How many NEW clients Leif could start TODAY and still be within the
  // ceiling for the whole of their programme. Not `max - active`: twelve
  // free slots today mean nothing if four people are already booked into
  // them next month. See occupancyLedger.ts for why this is the only
  // definition of "opening" that is safe to act on.
  openings: number | null;
  // Today's occupancy past the ceiling. A present fact, separate from the
  // forecast, and zero unless something has gone wrong.
  overCapacityBy: number;
  occupied: SlotHolder[];
  // Agreed and set up, not started. Real obligations against future
  // capacity — these are the six rows that made the dashboard say
  // eighteen, and they are counted in the ledger from their Start Week.
  committed: SlotHolder[];
  // Occupied containers with no computable end. They hold a slot for the
  // whole horizon, which is what not knowing actually implies.
  unknownEnd: SlotHolder[];
  // Occupied containers whose projected finish has already passed while
  // the client is still current. They keep their slot — arithmetic does
  // not end an engagement — and they are the single biggest reason a
  // future month can show no opening, so they are named rather than
  // buried.
  endProjectionOverdue: SlotHolder[];
  // Holders whose Start Week Leif has not stated — inferred from a booked
  // session, or carrying no traceable basis at all. They are still in
  // every number above; this is what says how much of the forecast is
  // resting on a guess.
  unconfirmedStartWeek: SlotHolder[];
  events: SlotEvent[];
  // Today, as the maths saw it. Keeps every consumer on one clock.
  today: string;
  durationMonths: number | null;
};

const toSlotHolder = (
  enrollment: SlotEnrollment,
  durationMonths: number | null,
): SlotHolder => ({
  enrollmentId: enrollment.id,
  contactId: enrollment.contactId ?? null,
  name: enrollment.name ?? "",
  status: enrollment.status,
  startDate: enrollment.start_date ?? null,
  startWeekConfirmed: isStartWeekConfirmed(enrollment),
  startDateSource: enrollment.start_date_source ?? null,
  end: projectedEndDate(enrollment, durationMonths),
});

export const computeIndividualCapacity = (
  enrollments: SlotEnrollment[],
  max: number | null,
  durationMonths: number | null,
  now: Date = new Date(),
): IndividualCapacity => {
  const today = toDateKey(now);
  const occupied: SlotHolder[] = [];
  const committed: SlotHolder[] = [];

  for (const enrollment of enrollments) {
    const phase = slotPhaseOf(enrollment, today);
    if (phase === "released") continue;
    const holder = toSlotHolder(enrollment, durationMonths);
    (phase === "occupied" ? occupied : committed).push(holder);
  }

  occupied.sort(byEndThenName);
  committed.sort(byStartThenName);

  const active = occupied.length;
  const events = buildSlotEvents(occupied, committed, today);

  return {
    max,
    active,
    openings:
      max == null
        ? null
        : safeOpeningsStartingOn(events, active, max, today, durationMonths),
    overCapacityBy: max == null ? 0 : Math.max(active - max, 0),
    occupied,
    committed,
    unknownEnd: occupied.filter((holder) => holder.end.basis === "unknown"),
    endProjectionOverdue: occupied.filter(
      (holder) => holder.end.date != null && holder.end.date < today,
    ),
    unconfirmedStartWeek: [...occupied, ...committed].filter(
      (holder) => !holder.startWeekConfirmed,
    ),
    events,
    today,
    durationMonths,
  };
};

// Soonest to finish first — the order Leif reads the list in when the
// question is "who frees up next". A holder with no computable end sorts
// last rather than being treated as ending today.
const byEndThenName = (a: SlotHolder, b: SlotHolder): number => {
  const aKey = a.end.date ?? "";
  const bKey = b.end.date ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  }
  return a.name.localeCompare(b.name);
};

const byStartThenName = (a: SlotHolder, b: SlotHolder): number => {
  const aKey = a.startDate ?? "";
  const bKey = b.startDate ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  }
  return a.name.localeCompare(b.name);
};

// One month in which the shape of the practice changes.
export type OpeningsMonth = {
  // YYYY-MM.
  month: string;
  // Containers projected to finish in this month.
  freeing: SlotHolder[];
  // Already-agreed containers starting in this month.
  committing: SlotHolder[];
  // The most people in the programme at any point during the month.
  peakOccupancy: number;
  // How far that peak goes past the ceiling. Zero unless the month is
  // over-committed.
  overCapacityBy: number;
  // How many NEW clients could start in this month and stay for the whole
  // programme without the ceiling ever being breached. THE number: see
  // occupancyLedger.ts.
  openings: number;
  // Whether every date this month's answer depends on was stated by Leif.
  restsOnUnconfirmedDates: boolean;
};

export type FutureOpenings = {
  months: OpeningsMonth[];
  // The event-by-event ledger the months are derived from. Nothing
  // recomputes it; a page that wants the detail reads this.
  ledger: LedgerEntry[];
  unknownEnd: SlotHolder[];
  unconfirmedStartWeek: SlotHolder[];
  endProjectionOverdue: SlotHolder[];
};

const monthOf = (date: string) => date.slice(0, 7);
const firstDayOf = (month: string) => `${month}-01`;
const lastDayOf = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
};

// When Leif could safely commit another client, month by month.
//
// Every month carries its own answer to one question: if a new client
// started in this month, would the practice stay within its ceiling for
// the whole four months they were in it? That is the only reading of
// "opening" that cannot mislead — and it is the reading under which
// October 2026 is NOT an opening, despite three containers finishing in
// it, because four people arrive on 8 November and take the practice to
// fifteen.
export const computeFutureOpenings = (
  capacity: IndividualCapacity,
  now: Date = new Date(),
): FutureOpenings => {
  const surfaced = {
    unknownEnd: capacity.unknownEnd,
    unconfirmedStartWeek: capacity.unconfirmedStartWeek,
    endProjectionOverdue: capacity.endProjectionOverdue,
  };
  if (capacity.max == null) {
    return { months: [], ledger: [] as LedgerEntry[], ...surfaced };
  }

  const today = toDateKey(now);
  const { events, active, max, durationMonths } = capacity;
  const ledger = computeLedger(events, active, max);

  const byMonth = new Map<
    string,
    { freeing: SlotHolder[]; committing: SlotHolder[] }
  >();
  const bucket = (month: string) => {
    let entry = byMonth.get(month);
    if (!entry) {
      entry = { freeing: [], committing: [] };
      byMonth.set(month, entry);
    }
    return entry;
  };

  for (const event of events) {
    const entry = bucket(monthOf(event.date));
    (event.kind === "end" ? entry.freeing : entry.committing).push(
      event.holder,
    );
  }

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entry]) => {
      // A candidate start cannot be in the past, so the current month is
      // evaluated from today.
      const candidateStart =
        firstDayOf(month) < today ? today : firstDayOf(month);
      const monthEnd = lastDayOf(month);
      const peakOccupancy = Math.max(
        occupancyOn(events, active, candidateStart),
        ...ledger
          .filter((e) => e.date >= candidateStart && e.date <= monthEnd)
          .map((e) => e.occupiedAfter),
      );

      return {
        month,
        freeing: entry.freeing.slice().sort(byEndThenName),
        committing: entry.committing.slice().sort(byStartThenName),
        peakOccupancy,
        overCapacityBy: Math.max(peakOccupancy - max, 0),
        openings: safeOpeningsStartingOn(
          events,
          active,
          max,
          candidateStart,
          durationMonths,
        ),
        restsOnUnconfirmedDates: [...entry.freeing, ...entry.committing].some(
          (holder) => !holder.startWeekConfirmed,
        ),
      };
    });

  return { months, ledger, ...surfaced };
};
