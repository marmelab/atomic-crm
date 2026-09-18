import type { Deal, SalesCall } from "../types";

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

export type SalesCallForOrdering = Pick<
  SalesCall,
  "opportunity_id" | "status" | "scheduled_at" | "scheduled_on"
>;

// The booked call an Opportunity is currently waiting on. Mirrors
// sales-calls/selectCurrentSalesCall.ts's precedence (a still-booked call
// outranks anything concluded) without importing its richer shape.
export const nextBookedCallByOpportunity = (
  salesCalls: readonly SalesCallForOrdering[] | undefined,
): Map<string, string> => {
  const byOpportunity = new Map<string, string>();
  for (const call of salesCalls ?? []) {
    if (call.status !== "booked") continue;
    if (call.opportunity_id == null) continue;
    const key = String(call.opportunity_id);
    const at = call.scheduled_at ?? `${call.scheduled_on}T23:59:00.000Z`;
    const existing = byOpportunity.get(key);
    // Earliest booked call is the one the column is about.
    if (!existing || at < existing) byOpportunity.set(key, at);
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

const nextCallFirst =
  (nextCallAt: Map<string, string>, now: number) =>
  (a: Deal, b: Deal): number => {
    // Three bands, in this order: future bookings (soonest first), past
    // unresolved bookings (soonest first), then no booking at all.
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
    case "committed":
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
  committed: "Waiting longest first",
};
