import type { SalesCall } from "../types";

// Two different operational problems, two different task types.
//
// Production acceptance found one type doing both jobs: a task reading
// "SALES CALL NEEDS MATCHING — Megan Auron · call of Jul 7, 2026 — what
// happened?" opened a matching page that answered "This booking is already
// attached to an Opportunity." Both halves were right about their own
// concern and the pair was a contradiction, because Megan's call does not
// need matching at all — what is unknown is what HAPPENED on it.
//
//   sales_call_needs_matching — this booking is not attached to any
//     Opportunity. The open question is WHICH sales relationship it
//     belongs to, and the answer is given on the matching page.
//
//   resolve_sales_call — this booking is attached to the right
//     Opportunity already. The open question is ATTENDANCE/OUTCOME, and
//     the answer is one of the three canonical actions (call happened /
//     no-show / cancelled).
//
// Naming follows what each task asks for, so the Dashboard label and the
// screen it opens can never disagree again.
export const SALES_CALL_NEEDS_MATCHING_TASK_TYPE = "sales_call_needs_matching";
export const RESOLVE_SALES_CALL_TASK_TYPE = "resolve_sales_call";

export type SalesCallAmbiguity =
  // Not attached to an Opportunity, not dismissed: genuinely needs matching.
  | "needs-matching"
  // Attached, but nobody ever recorded what happened on a call whose time
  // has passed.
  | "needs-outcome"
  // Nothing outstanding: dismissed, cancelled, attendance already recorded,
  // or simply a call that has not happened yet.
  | "none";

// The single source of truth for "what, if anything, is still unknown
// about this booking".
//
// Deliberately state-derived rather than task-derived: it is what the
// resolution page branches on, so a stale task can never make the page
// show the wrong question, and a task deleted by hand cannot hide a real
// gap. It reads only columns sales_calls actually has.
//
// Note on scope: "needs-outcome" describes a call, NOT a promise that a
// task exists for it. 109 attached historical calls in production have
// attendance = null because the import recorded their result as pipeline
// stage rather than as attendance; they are not open questions and must
// never be turned into 109 dashboard alerts. Ambiguity tasks stay
// deliberately created by the flow that noticed the ambiguity.
export const classifySalesCallAmbiguity = (
  salesCall: Pick<
    SalesCall,
    | "opportunity_id"
    | "dismissed_at"
    | "attendance"
    | "status"
    | "scheduled_at"
    | "scheduled_on"
  >,
  now: Date = new Date(),
): SalesCallAmbiguity => {
  if (salesCall.dismissed_at != null) return "none";
  if (salesCall.opportunity_id == null) return "needs-matching";
  // A cancelled call has a known, terminal answer already — "cancelled" is
  // what happened to it.
  if (salesCall.status === "cancelled") return "none";
  if (salesCall.attendance != null) return "none";
  // A call still in the future has no outcome to record yet. Asking "what
  // happened?" about a call that has not happened is the same class of
  // falsehood this module exists to remove.
  return hasHappenedBy(salesCall, now) ? "needs-outcome" : "none";
};

// Which Task, if any, a booking warrants right now.
//
// classifySalesCallAmbiguity above answers "what is unknown about this
// call?" — a question about the call, which the resolution pages branch
// on. This answers the narrower one the Task system needs: "is a Task of
// this kind warranted?" The difference is the deliberate-resolution gate.
// A call whose time has passed with no attendance is ambiguous; it is only
// WORK once somebody established it as an open question, because 109
// historical calls have no attendance and turning those into alerts would
// bury the real ones.
//
// The AUTHORITY is the SQL function public.sales_call_open_question();
// reconcile_sales_call_tasks() enforces it in both directions, hourly and
// for every writer including ones that never run app code. This is the
// app-side mirror, the same arrangement isActiveDeal has with
// deal_is_active — and the reason it exists is that the Acuity webhook's
// own hand-copy of a task type drifted from the app's and nothing caught
// it until four future bookings asked Leif what had happened on them.
export type SalesCallTaskQuestion = "matching" | "attendance" | "none";

export const salesCallTaskQuestion = (
  salesCall: Pick<
    SalesCall,
    | "opportunity_id"
    | "dismissed_at"
    | "attendance"
    | "status"
    | "scheduled_at"
    | "scheduled_on"
    | "resolution_requested_at"
  >,
  now: Date = new Date(),
): SalesCallTaskQuestion => {
  const ambiguity = classifySalesCallAmbiguity(salesCall, now);
  if (ambiguity === "needs-matching") return "matching";
  if (ambiguity === "none") return "none";
  return salesCall.resolution_requested_at != null ? "attendance" : "none";
};

// The Task type each question is asked with. A type absent from this map
// is not a sales-call question at all.
export const TASK_TYPE_FOR_QUESTION: Readonly<
  Record<Exclude<SalesCallTaskQuestion, "none">, string>
> = {
  matching: SALES_CALL_NEEDS_MATCHING_TASK_TYPE,
  attendance: RESOLVE_SALES_CALL_TASK_TYPE,
};

/**
 * Is an open Task of this type warranted by this booking?
 *
 * The invariant the Dashboard depends on: an open Task must never route to
 * a screen that answers "there is nothing to do here". Mihaela Petrova's
 * did — her booking had been matched, so the outcome page said "This call
 * is already resolved" while the row still offered Resolve.
 */
export const salesCallTaskIsWarranted = (
  taskType: string,
  salesCall: Parameters<typeof salesCallTaskQuestion>[0],
  now: Date = new Date(),
): boolean => {
  const question = salesCallTaskQuestion(salesCall, now);
  if (question === "none") return false;
  return TASK_TYPE_FOR_QUESTION[question] === taskType;
};

const hasHappenedBy = (
  salesCall: Pick<SalesCall, "scheduled_at" | "scheduled_on">,
  now: Date,
): boolean => {
  if (salesCall.scheduled_at) {
    return new Date(salesCall.scheduled_at).getTime() <= now.getTime();
  }
  if (!salesCall.scheduled_on) return false;
  // A date-only call counts as past once the DAY is over, never earlier —
  // its clock time is genuinely unknown, so the end of the day is the only
  // moment the whole day is certainly behind us.
  return salesCall.scheduled_on < toDateKey(now);
};

const toDateKey = (value: Date): string =>
  `${value.getFullYear()}-${String(value.getMonth() + 1).padStart(2, "0")}-${String(
    value.getDate(),
  ).padStart(2, "0")}`;
