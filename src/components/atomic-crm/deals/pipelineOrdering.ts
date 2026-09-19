import type { Deal } from "../types";
import {
  callInstant,
  selectSalesCallsByOpportunity,
  type SalesCallForSelection,
} from "../sales-calls/salesCallSelection";

// Every Kanban column sorts by the thing that column is actually for.
//
// All six columns used to share one rule — longest time in stage first —
// which is a reasonable default and the wrong answer for most of them. In
// Call Booked it put a stale unresolved call above a call happening in two
// hours; nothing on the board said "this is what today looks like".
//
// The rules below are deterministic, fully tie-broken, and derived only
// from fields that already exist. No scoring, no weighting, nothing
// invented.
//
//   Interested / Application Received
//     Most recently entered the stage FIRST. A new applicant is the
//     actionable one; somebody who has sat in Interested for months is
//     not more urgent, they are colder.
//
//   Approved
//     Same: most recently approved first. These are people waiting to
//     book, and the freshest approval is the one most likely to convert.
//
//   Call Booked
//     The next genuine booked call FIRST, farthest LAST — Leif's stated
//     requirement. A call whose time has passed and was never resolved
//     sorts BELOW every future booking rather than above them: it is
//     unfinished admin, not the next thing happening. An Opportunity in
//     this stage with no booked call at all sorts last of all.
//
//   Decision
//     Follow-up chronology, in four bands: overdue (oldest broken promise
//     first), due today, due later (soonest first), then no follow-up
//     date at all. Within a band, longest-waiting first. The date is a
//     commitment Leif made, and a promise already broken outranks one
//     that is merely upcoming.
//
//   Committed
//     Longest waiting FIRST. Committed means somebody said yes and
//     something is still required of Leif; the one who said yes earliest
//     has been waiting longest for it.
//
// Ties everywhere break on Opportunity id descending so the order is
// stable across renders and never depends on row arrival order.

export type SalesCallForOrdering = SalesCallForSelection;

// The booked call an Opportunity is currently waiting on.
//
// This used to be a second, independent reading of the sales calls, which
// meant the board and the drawer could disagree about the same
// relationship. It now projects the ONE model in
// sales-calls/salesCallSelection.ts down to the single value the
// comparator needs.
export const nextBookedCallByOpportunity = (
  salesCalls: readonly SalesCallForOrdering[] | undefined,
): Map<string, string> => {
  const byOpportunity = new Map<string, string>();
  for (const [id, view] of selectSalesCallsByOpportunity(salesCalls)) {
    const at = view.booked ? callInstant(view.booked) : null;
    if (at) byOpportunity.set(id, at);
  }
  return byOpportunity;
};

const byIdDescending = (a: Deal, b: Deal): number =>
  Number(b.id) - Number(a.id);

const enteredStageAt = (deal: Deal): number =>
  new Date(deal.stage_entered_at).getTime();

const mostRecentlyEnteredFirst = (a: Deal, b: Deal): number => {
  const diff = enteredStageAt(b) - enteredStageAt(a);
  return diff !== 0 ? diff : byIdDescending(a, b);
};

const longestWaitingFirst = (a: Deal, b: Deal): number => {
  const diff = enteredStageAt(a) - enteredStageAt(b);
  return diff !== 0 ? diff : byIdDescending(a, b);
};

/**
 * Cards in Call Booked with no booked call behind them.
 *
 * The stage asserts there is a call in the calendar. When there is not,
 * the card is not merely unsorted — it is inconsistent, and saying so is
 * the point: the previous behaviour let such a card fall into the
 * "no booking" band and take an id-based position that looks exactly like
 * a legitimate order.
 */
export const inconsistentCallBookedDeals = (
  deals: readonly Deal[] | undefined,
  nextCallAt: Map<string, string>,
): Deal[] =>
  (deals ?? []).filter(
    (deal) => deal.stage === "call_booked" && !nextCallAt.has(String(deal.id)),
  );

const nextCallFirst =
  (nextCallAt: Map<string, string>, now: number) =>
  (a: Deal, b: Deal): number => {
    // Three bands, in this order: future bookings (soonest first), past
    // unresolved bookings (soonest first), then no booking at all — which
    // in this column means the card is inconsistent with its own stage.
    const rank = (deal: Deal): { band: number; at: string } => {
      const at = nextCallAt.get(String(deal.id));
      if (!at) return { band: 2, at: "" };
      return { band: new Date(at).getTime() >= now ? 0 : 1, at };
    };

    const ra = rank(a);
    const rb = rank(b);
    if (ra.band !== rb.band) return ra.band - rb.band;
    if (ra.at !== rb.at) return ra.at.localeCompare(rb.at);
    return byIdDescending(a, b);
  };

/**
 * "Follow-up soonest first", meaning exactly one thing.
 *
 * `deals.follow_up_date` is the only source. It is a commitment Leif made,
 * and the follow-up Task that projects it carries the same date — there is
 * deliberately no second follow-up date to disagree with it.
 *
 * Four bands, because a date on its own does not say how urgent it is:
 *
 *   0  overdue    — the promise has already been broken. Oldest first, so
 *                   the one broken longest is the one shouting loudest.
 *   1  today      — owed today.
 *   2  later      — soonest first.
 *   3  no date    — no promise was ever made.
 *
 * Within a band, and for the whole of band 3, longest-waiting breaks the
 * tie: with nothing promised, time in the stage is the only real signal.
 *
 * Dates are compared as calendar days in the CRM's own timezone. A
 * follow-up due "today" is due today wherever the server happens to be.
 */
export const FOLLOW_UP_BANDS = {
  overdue: 0,
  today: 1,
  later: 2,
  none: 3,
} as const;

const CRM_TIME_ZONE = "America/Denver";

const dayKeyFormatter = new Intl.DateTimeFormat("en-CA", {
  timeZone: CRM_TIME_ZONE,
  year: "numeric",
  month: "2-digit",
  day: "2-digit",
});

/** The CRM-local calendar day of an instant, as YYYY-MM-DD. */
export const crmDayKey = (at: number | Date): string =>
  dayKeyFormatter.format(at instanceof Date ? at : new Date(at));

// follow_up_date is already a date, so only the day part is meaningful; a
// value that arrives as a full timestamp is trimmed rather than parsed,
// which keeps the comparison in calendar days and out of timezone
// arithmetic.
const followUpDay = (deal: Deal): string | null => {
  const raw = deal.follow_up_date;
  if (!raw) return null;
  const day = String(raw).slice(0, 10);
  return day || null;
};

export const followUpBand = (
  deal: Deal,
  today: string,
): (typeof FOLLOW_UP_BANDS)[keyof typeof FOLLOW_UP_BANDS] => {
  const day = followUpDay(deal);
  if (!day) return FOLLOW_UP_BANDS.none;
  if (day < today) return FOLLOW_UP_BANDS.overdue;
  if (day === today) return FOLLOW_UP_BANDS.today;
  return FOLLOW_UP_BANDS.later;
};

const soonestFollowUpFirst =
  (now: number) =>
  (a: Deal, b: Deal): number => {
    const today = crmDayKey(now);
    const bandA = followUpBand(a, today);
    const bandB = followUpBand(b, today);
    if (bandA !== bandB) return bandA - bandB;

    // Both overdue and both later sort by the date itself, ascending —
    // oldest broken promise first, soonest upcoming promise first. Same
    // direction, and it is the right one in both bands.
    const dayA = followUpDay(a);
    const dayB = followUpDay(b);
    if (dayA && dayB && dayA !== dayB) return dayA.localeCompare(dayB);

    return longestWaitingFirst(a, b);
  };

export const comparatorForStage = (
  stage: string,
  context: { nextCallAt: Map<string, string>; now?: number },
): ((a: Deal, b: Deal) => number) => {
  switch (stage) {
    case "interested":
    case "application_received":
    case "approved":
      return mostRecentlyEnteredFirst;
    case "call_booked":
      return nextCallFirst(context.nextCallAt, context.now ?? Date.now());
    case "decision":
      return soonestFollowUpFirst(context.now ?? Date.now());
    case "onboarding":
      return longestWaitingFirst;
    default:
      // An unrecognized or custom stage keeps the previous behaviour
      // rather than throwing or guessing a new rule.
      return longestWaitingFirst;
  }
};

// Human-readable, so the board can say why it is ordered the way it is
// instead of leaving Leif to reverse-engineer it.
export const ORDERING_RULE_LABELS: Record<string, string> = {
  interested: "Newest first",
  application_received: "Newest first",
  approved: "Newest first",
  call_booked: "Next call first",
  decision: "Follow-up soonest first",
  onboarding: "Waiting longest first",
};
