import {
  buildSlotEvents,
  computeLedger,
  occupancyOn,
  safeOpeningsStartingOn,
  type LedgerEntry,
  type OpeningsAnswer,
  type SlotEvent,
} from "./occupancyLedger";
import {
  computeExpectedEnd,
  crossWeekReschedules,
  type SessionWeek,
} from "./sessionWeeks";
import {
  isStartWeekConfirmed,
  type SlotEnrollment,
  type SlotHolder,
} from "./slotHolder";
import { slotPhaseOf, toDateKey } from "./slotOccupancy";
import { isSafeOpening, weekCapacities } from "./weekCapacity";

export type { SlotEnrollment, SlotHolder } from "./slotHolder";

export type IndividualCapacity = {
  max: number | null;
  // People in the programme today.
  active: number;
  // How many NEW clients Leif could start TODAY — the ceiling holding for
  // the whole of their container AND their twelve session weeks existing
  // on the calendar. Not `max - active`.
  openings: OpeningsAnswer | null;
  // Today's occupancy past the ceiling. A present fact, separate from the
  // forecast, and zero unless something has gone wrong.
  overCapacityBy: number;
  occupied: SlotHolder[];
  // Agreed and set up, not started. Real obligations against future
  // capacity, counted in the ledger from their Start Date.
  committed: SlotHolder[];
  // Holders whose container cannot be ended: no Start Date to count from,
  // or a Year Tracking calendar that stops before their twelfth week.
  // They hold a slot for the whole horizon, because that is what not
  // knowing implies.
  unknownEnd: SlotHolder[];
  // The subset whose end is unknown specifically because the calendar runs
  // out — the ones a few more `1:1s` weeks would answer.
  needsCalendar: SlotHolder[];
  // Holders whose Start Week Leif has not stated.
  unconfirmedStartWeek: SlotHolder[];
  events: SlotEvent[];
  // The last day Year Tracking reaches. Beyond it the CRM knows nothing,
  // and says so rather than projecting into an empty calendar.
  calendarHorizon: string | null;
  today: string;
  weeks: SessionWeek[];
};

const toSlotHolder = (
  enrollment: SlotEnrollment,
  weeks: SessionWeek[],
): SlotHolder => {
  const extensions = crossWeekReschedules(
    enrollment.cadenceClassifications ?? [],
  );
  return {
    enrollmentId: enrollment.id,
    contactId: enrollment.contactId ?? null,
    name: enrollment.name ?? "",
    status: enrollment.status,
    startDate: enrollment.start_date ?? null,
    startWeekConfirmed: isStartWeekConfirmed(enrollment),
    startDateSource: enrollment.start_date_source ?? null,
    // A recorded end date is somebody's decision and outranks the
    // calendar arithmetic entirely.
    end: enrollment.end_date
      ? {
          status: "known" as const,
          finalWeek: { start: enrollment.end_date, end: enrollment.end_date },
          lastDay: enrollment.end_date,
          freesOn: enrollment.end_date,
          weeksRequired: 0,
          extensions,
        }
      : computeExpectedEnd(weeks, enrollment.start_date ?? null, extensions),
    extensions,
  };
};

export const computeIndividualCapacity = (
  enrollments: SlotEnrollment[],
  max: number | null,
  weeks: SessionWeek[],
  now: Date = new Date(),
): IndividualCapacity => {
  const today = toDateKey(now);
  const occupied: SlotHolder[] = [];
  const committed: SlotHolder[] = [];

  for (const enrollment of enrollments) {
    const phase = slotPhaseOf(enrollment, today);
    if (phase === "released") continue;
    const holder = toSlotHolder(enrollment, weeks);
    (phase === "occupied" ? occupied : committed).push(holder);
  }

  // Current clients newest first; people who have not started yet,
  // soonest first.
  //
  // The two lists answer different questions, so they are not the same
  // sort reversed. Current Clients is who Leif is working with now, and
  // the person who joined most recently is the one he is still learning —
  // the ones from May he knows. Starting Later is a queue, and a queue is
  // read from the front: the next person to arrive is the one that matters.
  //
  // Current Clients was ordered by expected END date, which is derived
  // from a calendar and moves whenever Year Tracking changes — so the list
  // silently reordered itself after a sync, around a date that is a
  // projection rather than a fact about the person.
  occupied.sort(byStartDescThenName);
  committed.sort(byStartThenName);

  const active = occupied.length;
  const events = buildSlotEvents(occupied, committed, today);
  const everyone = [...occupied, ...committed];
  const sorted = [...weeks].sort((a, b) => a.start.localeCompare(b.start));

  return {
    max,
    active,
    openings:
      max == null
        ? null
        : safeOpeningsStartingOn(events, active, max, today, weeks),
    overCapacityBy: max == null ? 0 : Math.max(active - max, 0),
    occupied,
    committed,
    unknownEnd: everyone.filter((holder) => holder.end?.status !== "known"),
    needsCalendar: everyone.filter(
      (holder) => holder.end?.status === "incomplete",
    ),
    unconfirmedStartWeek: everyone.filter(
      (holder) => !holder.startWeekConfirmed,
    ),
    events,
    calendarHorizon: sorted.length ? sorted[sorted.length - 1]!.end : null,
    today,
    weeks,
  };
};

// Soonest to finish first. A holder whose end cannot be computed sorts
// last rather than being treated as ending today.
const byEndThenName = (a: SlotHolder, b: SlotHolder): number => {
  const aKey = a.end?.status === "known" ? a.end.freesOn : "";
  const bKey = b.end?.status === "known" ? b.end.freesOn : "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return aKey.localeCompare(bKey);
  }
  return a.name.localeCompare(b.name);
};

// Newest Start Date first, name ascending within a date so the order is
// stable. A holder with no Start Date sorts last: they are not newer than
// everybody, they are unknown, and a question for Leif.
const byStartDescThenName = (a: SlotHolder, b: SlotHolder): number => {
  const aKey = a.startDate ?? "";
  const bKey = b.startDate ?? "";
  if (aKey !== bKey) {
    if (!aKey) return 1;
    if (!bKey) return -1;
    return bKey.localeCompare(aKey);
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
  // Containers whose final session week ends in this month.
  freeing: SlotHolder[];
  // Already-agreed containers starting in this month.
  committing: SlotHolder[];
  // The most people in the programme at any point during the month.
  peakOccupancy: number;
  // How far that peak goes past the ceiling.
  overCapacityBy: number;
  // Whether a new client could start in this month — and if not, whether
  // that is because there is no room or because the calendar runs out.
  // The best eligible WEEK in the month, not the month's first day.
  openings: OpeningsAnswer;
  // The week that answer belongs to, when there is one. A month is not a
  // date Leif can offer somebody; a week is.
  earliestSafeStart: SessionWeek | null;
  // Whether this month's answer depends on a Start Week nobody confirmed.
  restsOnUnconfirmedDates: boolean;
};

export type FutureOpenings = {
  months: OpeningsMonth[];
  // The event-by-event ledger the months are derived from. Nothing
  // recomputes it.
  ledger: LedgerEntry[];
  unknownEnd: SlotHolder[];
  needsCalendar: SlotHolder[];
  unconfirmedStartWeek: SlotHolder[];
  calendarHorizon: string | null;
};

const monthOf = (date: string) => date.slice(0, 7);
const firstDayOf = (month: string) => `${month}-01`;
const lastDayOf = (month: string) => {
  const [year, m] = month.split("-").map(Number);
  return `${month}-${String(new Date(Date.UTC(year!, m!, 0)).getUTCDate()).padStart(2, "0")}`;
};

// When Leif could safely commit another client, month by month.
export const computeFutureOpenings = (
  capacity: IndividualCapacity,
  now: Date = new Date(),
): FutureOpenings => {
  const surfaced = {
    unknownEnd: capacity.unknownEnd,
    needsCalendar: capacity.needsCalendar,
    unconfirmedStartWeek: capacity.unconfirmedStartWeek,
    calendarHorizon: capacity.calendarHorizon,
  };
  if (capacity.max == null) {
    return { months: [], ledger: [] as LedgerEntry[], ...surfaced };
  }

  const today = toDateKey(now);
  const { events, active, max, weeks } = capacity;
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

  // Candidate starts are evaluated per `1:1s` WEEK, and a month's answer
  // is its best week's.
  //
  // Asked only of the 1st, a month reports whatever happened to be true on
  // one arbitrary day: December could read "no opening" while the week of
  // the 21st was perfectly safe, and nothing on screen could tell that
  // apart from "December is full". It also cannot answer the question Leif
  // actually asks — WHEN — because a month is not a date he can offer
  // somebody.
  //
  // The rule is untouched: safeOpeningsStartingOn still decides, and still
  // requires both halves. Only the candidate dates changed, from one day a
  // month to the weeks Year Tracking actually contains. The dashboard and
  // the programme page read this same answer, so neither can name a month
  // the other does not.
  const allWeeks = weekCapacities({ max, active, events, weeks }, now);

  const months = [...byMonth.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, entry]) => {
      const candidateStart =
        firstDayOf(month) < today ? today : firstDayOf(month);
      const monthEnd = lastDayOf(month);
      const peakOccupancy = Math.max(
        occupancyOn(events, active, candidateStart),
        ...ledger
          .filter((e) => e.date >= candidateStart && e.date <= monthEnd)
          .map((e) => e.occupiedAfter),
      );

      const monthWeeks = allWeeks.filter(
        (week) => week.week.start.slice(0, 7) === month,
      );
      const best = monthWeeks.find(isSafeOpening);
      const testable = monthWeeks.find(
        (week) => week.safeStart.answer.status === "known",
      );

      return {
        month,
        freeing: entry.freeing.slice().sort(byEndThenName),
        committing: entry.committing.slice().sort(byStartThenName),
        peakOccupancy,
        overCapacityBy: Math.max(peakOccupancy - max, 0),
        // The first week somebody could actually start; failing that the
        // first week that could be tested at all; failing that, the answer
        // for the month's own first candidate day, which is "the calendar
        // does not reach".
        openings:
          (best ?? testable)?.safeStart.answer ??
          monthWeeks[0]?.safeStart.answer ??
          safeOpeningsStartingOn(events, active, max, candidateStart, weeks),
        earliestSafeStart: best?.week ?? null,
        restsOnUnconfirmedDates: [...entry.freeing, ...entry.committing].some(
          (holder) => !holder.startWeekConfirmed,
        ),
      };
    });

  return { months, ledger, ...surfaced };
};
