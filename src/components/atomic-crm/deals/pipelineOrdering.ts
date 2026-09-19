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
//     Soonest follow-up date FIRST, because that date is a commitment
//     Leif made. Opportunities with no follow-up date fall back to
//     longest-waiting, which is the genuine urgency signal when no
//     promise has been made.
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

const soonestFollowUpFirst = (a: Deal, b: Deal): number => {
  const aDate = a.follow_up_date ?? "";
  const bDate = b.follow_up_date ?? "";
  if (aDate !== bDate) {
    // A promised follow-up outranks having made no promise.
    if (!aDate) return 1;
    if (!bDate) return -1;
    return aDate.localeCompare(bDate);
  }
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
      return soonestFollowUpFirst;
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
