// When a Living Example container actually ends.
//
// Not four calendar months. The Living Example is **12 sessions across
// Leif's available 1:1 weeks**, and which weeks those are lives in one
// place: the Year Tracking calendar, whose `1:1s` events are synced into
// expected_session_windows. A summer with no 1:1 weeks in it does not
// shorten anybody's container; it moves their finish later.
//
// The previous engine used start_date + the Offer's "4 months". On this
// calendar that is wrong by months, not days — there are no eligible weeks
// at all between 2 July and 13 September 2026, so a client who started in
// June finishes a whole season later than the arithmetic said. "4 months"
// stays what it always was: descriptive business language on the Offer.
//
// Three facts, kept apart on purpose:
//
//   the CALENDAR says which weeks Leif is open,
//   the START DATE says which of those weeks is this client's Session
//     Week #1,
//   and a cross-week RESCHEDULE says one eligible week was consumed
//     without a session being delivered, so the entitlement needs one
//     more.
//
// Nothing here reads an Acuity booking. A client may book Session #1 early,
// late, or not at all, and none of it moves their Start Date or their end.

// One `1:1s` week from Year Tracking. `end` is EXCLUSIVE, matching
// Google's own all-day-event semantics and the expected_session_windows
// column it comes from: a Mon–Fri week is start=Mon, end=Sat.
export type SessionWeek = {
  start: string;
  end: string;
  title?: string;
};

export const SESSIONS_PER_CONTAINER = 12;

export type ExpectedEnd =
  | {
      status: "known";
      // The week Session #12 (plus any extensions) falls in.
      finalWeek: SessionWeek;
      // The last day of that week — window_end is exclusive, so this is
      // the day before it.
      lastDay: string;
      // The first day the slot is free again. Exactly window_end, which
      // is what the occupancy ledger needs.
      freesOn: string;
      // How many eligible weeks the container consumes: 12, plus one per
      // cross-week reschedule.
      weeksRequired: number;
      extensions: number;
    }
  | {
      // Leif has not filled Year Tracking far enough ahead to know. This
      // is a real answer and it is shown as one — never a date worked out
      // by pretending the calendar continues.
      status: "incomplete";
      weeksScheduled: number;
      weeksRequired: number;
      extensions: number;
      // The last eligible week the calendar does contain, so the page can
      // say how far the plan currently reaches.
      lastKnownWeek: SessionWeek | null;
    };

const byWeek = (a: SessionWeek, b: SessionWeek): number =>
  a.start.localeCompare(b.start) || a.end.localeCompare(b.end);

// The eligible weeks for one container, Session Week #1 first.
//
// Session Week #1 is the `1:1s` week the Start Date falls IN, not the next
// one after it. Leif sets a Start Date inside the week he means; requiring
// the week to begin on or after it silently skips a week whenever he picks
// any day but the Monday. Against the real calendar that was happening to
// Gina, Ava and Denise.
//
// `end` is exclusive, so "the week containing the Start Date, or else the
// next one" is exactly `end > startDate`.
// Identical windows are counted once. Year Tracking currently holds two
// separate `1:1s` events for the week of 17 May 2026, and what is being
// counted here is WEEKS Leif is open, not calendar entries.
//
// Counting that week twice spends two of a client's twelve sessions on one
// real week, so the twelfth lands a week EARLY and the container is
// credited with a session that had nowhere to happen. Against production
// it ended Jules a week before he should have. Whether the duplicate event
// should exist is a question for Leif; miscounting it is not.
export const eligibleWeeksFrom = (
  weeks: SessionWeek[],
  startDate: string,
): SessionWeek[] => {
  const seen = new Set<string>();
  return weeks
    .filter((week) => {
      if (week.end <= startDate) return false;
      const key = `${week.start}..${week.end}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort(byWeek);
};

// The 12-eligible-week rule, plus deterministic extensions.
//
// `extensions` is one per CROSS-WEEK reschedule: an eligible week that
// went by without a session because the session moved into a later week.
// The entitlement survives, so the container needs one more eligible week
// at the end. A time or day change inside the same week is not one of
// these and never reaches here — see occupancyLedger.ts's caller and
// crossWeekReschedules() below.
//
// A skipped week, a no-show and a ghosted session all extend nothing: the
// session is forfeited under the no-rollover rule, and an exception to
// that is Leif's to make, not the CRM's to assume.
export const computeExpectedEnd = (
  weeks: SessionWeek[],
  startDate: string | null,
  extensions = 0,
): ExpectedEnd | null => {
  if (!startDate) return null;

  const weeksRequired = SESSIONS_PER_CONTAINER + Math.max(extensions, 0);
  const eligible = eligibleWeeksFrom(weeks, startDate);

  if (eligible.length < weeksRequired) {
    return {
      status: "incomplete",
      weeksScheduled: eligible.length,
      weeksRequired,
      extensions,
      lastKnownWeek: eligible[eligible.length - 1] ?? null,
    };
  }

  const finalWeek = eligible[weeksRequired - 1]!;
  return {
    status: "known",
    finalWeek,
    lastDay: dayBefore(finalWeek.end),
    freesOn: finalWeek.end,
    weeksRequired,
    extensions,
  };
};

// How many eligible weeks a container has consumed without delivering a
// session, in a way that preserves the entitlement.
//
// The signal is already in the data, and it is exact. A cadence issue is
// raised per (Enrollment, assigned week) only when that week closed with
// no session scheduled inside it — so a session moved to a different
// TIME on a different DAY of the same week never raises one, and a session
// moved into a later week always does. Leif then says what happened.
// 'rescheduled' is therefore a cross-week reschedule by construction;
// nothing needs to parse an Acuity reschedule counter, which would have
// counted same-week changes too.
export const crossWeekReschedules = (
  classifications: (string | null)[],
): number =>
  classifications.filter((classification) => classification === "rescheduled")
    .length;

// The most a container could still grow by, if every week still owing a
// decision turned out to be a cross-week reschedule.
//
// Not a forecast and never used as one — it exists only to ask whether an
// unresolved week could change an answer the CRM is about to state as
// fact. An opening that survives this is one nothing outstanding can take
// away; an opening that does not is a projection, and should say so.
//
// The upper bound is the right question because the downside is
// asymmetric: telling Leif a week is free and then taking it back is worse
// than telling him it might move.
export const maxPlausibleWeeks = (classifications: (string | null)[]): number =>
  classifications.filter(
    (classification) =>
      classification === "rescheduled" || classification == null,
  ).length;

// Exported because a week's `end` is exclusive everywhere it is used:
// anything showing a week to a person needs its last real day, and two
// copies of this would be two chances to be off by one.
export const dayBefore = (isoDate: string): string => {
  const date = new Date(`${isoDate}T00:00:00Z`);
  date.setUTCDate(date.getUTCDate() - 1);
  return date.toISOString().slice(0, 10);
};
