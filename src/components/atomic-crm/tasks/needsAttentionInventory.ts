import type { Task } from "../types";

// The complete inventory of what can appear in Needs Attention, and what
// each row actually asks.
//
// Before this, every row shouted its internal type in uppercase and left
// Leif to work out what it wanted — "SALES CALL NEEDS MATCHING" above a
// sentence that already explained the problem, and in one case above a
// screen that disagreed with it. The types were also patched one at a time,
// so each fix left the others alone.
//
// One model, all of them, each answering the same four questions:
//
//   WHO            the Task's own text names the person
//   WHAT           the human question, not the enum
//   WHEN           where urgency comes from
//   WHAT DO I DO   the control the row opens
export type NeedsAttentionKind = {
  // The value stored in tasks.type.
  type: string;
  // What Leif reads. Sentence case, never shouted, never the enum.
  label: string;
  // The question this row is really asking.
  question: string;
  // What creates it.
  createdWhen: string;
  // Where it takes him, in terms of taskActionDestination's own kinds.
  destination: string;
  // What resolving it looks like.
  resolution: string;
  // Closed by the system when this becomes true.
  closesAutomaticallyWhen: string;
  // Whether Leif can also tick it off by hand.
  manuallyCompletable: boolean;
  // Lower sorts first. Derived from how much a delay costs, not from an
  // arbitrary weighting: a booking nobody can attribute, and a call whose
  // outcome is unknown, both silently corrupt the pipeline; a follow-up is
  // a promise with a date; a cadence gap is a question about the past.
  urgency: number;
  // Where the date on the row comes from, or null when the task's own
  // due_date is an internal artefact rather than a commitment.
  dueDateMeans: string | null;
};

export const NEEDS_ATTENTION_KINDS: readonly NeedsAttentionKind[] = [
  {
    type: "sales_call_needs_matching",
    label: "Sales call needs matching",
    question: "Which Opportunity does this booking belong to?",
    createdWhen:
      "An Acuity booking arrives that cannot be matched to exactly one active Opportunity.",
    destination: "sales-call-needs-matching → /sales-calls/:id/resolve",
    resolution: "Attach to an Opportunity, create the right one, or dismiss.",
    closesAutomaticallyWhen:
      "sales_calls.opportunity_id stops being NULL, by any route — a database trigger enforces this, so a SQL backfill closes it too.",
    manuallyCompletable: false,
    urgency: 0,
    dueDateMeans: null,
  },
  {
    type: "resolve_sales_call",
    label: "Resolve sales call",
    question: "What happened on this call?",
    createdWhen:
      "A call is attached to the right Opportunity and its attendance was never recorded. Created deliberately, never derived — 109 historical calls have no attendance and are not open questions.",
    destination: "resolve-sales-call → /sales-calls/:id/outcome",
    resolution: "Call happened, No-show, or Cancelled.",
    closesAutomaticallyWhen:
      "Any of the three canonical outcomes is recorded for that call.",
    manuallyCompletable: false,
    urgency: 1,
    dueDateMeans: null,
  },
  {
    type: "sales_call",
    label: "Sales call",
    question: "This call is coming up.",
    createdWhen: "A booking is matched to an Opportunity.",
    destination: "opportunity-context → /deals/:id/show",
    resolution: "Run the call, then record its outcome.",
    closesAutomaticallyWhen:
      "The call's outcome is recorded, or the booking is cancelled.",
    manuallyCompletable: true,
    urgency: 3,
    dueDateMeans: "When the call is scheduled",
  },
  {
    type: "follow_up",
    label: "Follow up",
    question: "You said you would come back to this person.",
    createdWhen:
      "A sales call ends with the prospect still thinking, and a follow-up date is set.",
    destination: "opportunity-context → /deals/:id/show",
    resolution: "Record the decision: Yes, No, or remove from pipeline.",
    closesAutomaticallyWhen: "A sales decision is recorded for that person.",
    manuallyCompletable: true,
    urgency: 2,
    dueDateMeans: "The follow-up date you promised yourself",
  },
  {
    type: "nurture_follow_up",
    label: "Nurture follow-up",
    question: "Worth coming back to this one?",
    createdWhen: "An Opportunity exits to Nurture with a date to revisit.",
    destination: "opportunity-context → /deals/:id/show",
    resolution: "Re-engage, or remove from pipeline for good.",
    closesAutomaticallyWhen: "A sales decision is recorded for that person.",
    manuallyCompletable: true,
    urgency: 5,
    dueDateMeans: "When to revisit",
  },
  {
    type: "sales_call_cancelled",
    label: "Call cancelled",
    question: "Their call was cancelled — what now?",
    createdWhen:
      "Retired. Historically created when a cancellation stranded an Opportunity in Call Booked; cancellation now returns it to Approved, where the Approved actions answer this.",
    destination: "opportunity-context → /deals/:id/show",
    resolution: "Keep waiting, nurture, or remove from pipeline.",
    closesAutomaticallyWhen: "A sales decision is recorded for that person.",
    manuallyCompletable: true,
    urgency: 4,
    dueDateMeans: null,
  },
  {
    type: "sales_call_no_show",
    label: "They did not show",
    question: "Do they want to rebook?",
    createdWhen:
      "Retired. Historically created when a call was recorded as a no-show; the no-show action now exits the Opportunity, so there is no stranded decision to re-surface.",
    destination: "opportunity-context → /deals/:id/show",
    resolution: "Rebook them, or remove from pipeline.",
    closesAutomaticallyWhen:
      "A fresh booking is made for that person, or a sales decision is recorded.",
    manuallyCompletable: true,
    urgency: 4,
    dueDateMeans: null,
  },
  {
    type: "resolve_client_session_cadence",
    label: "Session week to resolve",
    question: "No session was booked that week — what happened?",
    createdWhen:
      "An active client's expected weekly session window passes with nothing booked in it.",
    destination:
      "resolve-client-session-cadence → /client-session-cadence/:id/resolve",
    resolution:
      "Say whether it was a known skip, rescheduled elsewhere, or missed.",
    closesAutomaticallyWhen:
      "A session is found in that window, or the issue is resolved explicitly.",
    manuallyCompletable: false,
    urgency: 6,
    dueDateMeans: "The week in question",
  },
  {
    type: "onboarding_item",
    label: "Onboarding step",
    question: "A step in setting this client up is outstanding.",
    createdWhen:
      "An Opportunity is Won and its Offer has required onboarding items.",
    destination: "enrollment-context → /enrollments/:id/show",
    resolution: "Complete the step on the client's own page.",
    closesAutomaticallyWhen: "The checklist item is marked complete.",
    manuallyCompletable: true,
    urgency: 7,
    dueDateMeans: "When the step is due",
  },
  {
    type: "offboarding_item",
    label: "Offboarding step",
    question: "A step in winding this client down is outstanding.",
    createdWhen: "A client enters offboarding.",
    destination: "enrollment-context → /enrollments/:id/show",
    resolution: "Complete the step on the client's own page.",
    closesAutomaticallyWhen: "The checklist item is marked complete.",
    manuallyCompletable: true,
    urgency: 8,
    dueDateMeans: "When the step is due",
  },
  {
    type: "review_application",
    label: "Application to review",
    question: "Someone applied — is this a fit?",
    createdWhen: "An application is submitted through the public form.",
    destination: "application-review → /applications/:id/show",
    resolution: "Approve, Needs Higher Care, Not Fit, or Do Not Engage.",
    closesAutomaticallyWhen: "The application is reviewed.",
    manuallyCompletable: false,
    urgency: 2,
    dueDateMeans: "When it was submitted",
  },
  {
    type: "check_payment",
    label: "Check payment",
    question: "Has this payment arrived?",
    createdWhen: "A payment is expected and needs confirming.",
    destination: "opportunity-context → /deals/:id/show",
    resolution: "Confirm the payment state on the Opportunity.",
    closesAutomaticallyWhen:
      "Never automatically — payment truth is confirmed by a human or by Stripe reconciliation.",
    manuallyCompletable: true,
    urgency: 4,
    dueDateMeans: "When the payment was expected",
  },
  {
    type: "other",
    label: "To do",
    question: "Whatever you wrote down.",
    createdWhen: "Leif creates it by hand.",
    destination: "task-detail → the Task's own editor",
    resolution: "Do it, then tick it off.",
    closesAutomaticallyWhen: "Never — it is a manual note to self.",
    manuallyCompletable: true,
    urgency: 9,
    dueDateMeans: "Whatever date you set",
  },
];

const BY_TYPE = new Map(NEEDS_ATTENTION_KINDS.map((k) => [k.type, k]));

export const describeTaskKind = (
  type: string | null | undefined,
): NeedsAttentionKind | null => (type ? (BY_TYPE.get(type) ?? null) : null);

// Some task types carry a due_date that is an internal DB-required field
// set to "now" at creation rather than a commitment anybody made. Those
// rows must not be presented as overdue.
export const hasMeaningfulDueDate = (
  type: string | null | undefined,
): boolean => describeTaskKind(type)?.dueDateMeans != null;

// Most urgent first, then by date, then by id so the order is stable.
export const byOperationalUrgency = (
  a: Pick<Task, "id" | "type" | "due_date">,
  b: Pick<Task, "id" | "type" | "due_date">,
): number => {
  const ua = describeTaskKind(a.type)?.urgency ?? 99;
  const ub = describeTaskKind(b.type)?.urgency ?? 99;
  if (ua !== ub) return ua - ub;

  const da = hasMeaningfulDueDate(a.type) ? (a.due_date ?? "") : "";
  const db = hasMeaningfulDueDate(b.type) ? (b.due_date ?? "") : "";
  if (da !== db) {
    if (!da) return 1;
    if (!db) return -1;
    return da.localeCompare(db);
  }
  return Number(a.id) - Number(b.id);
};
