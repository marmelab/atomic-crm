// Task action-destination policy (real human Auth acceptance testing found
// "Review Application: SalesId Verify" clickable nowhere useful — the type
// label was plain text, and the only real link went to the Contact, not
// the Application). A Task is an action launcher, not just a reminder:
// clicking its primary title should take the user directly to where that
// action is actually performed.
//
// Pure classification only — no data fetching, no I/O — kept separate from
// useTaskActionDestination.ts (which resolves an actual record id for a
// given Contact) so the policy itself stays trivially testable and reused
// consistently wherever Tasks render (there is exactly one shared row
// component, Task.tsx — used by the Dashboard, the Contact page's task
// list, and the mobile Tasks list alike — so fixing the policy there
// covers every surface).
//
// `Task.type` is a plain string, not a fixed union (see types.ts) — task
// types are configurable per deployment via <CRM taskTypes={...}>, so an
// unrecognized/custom type must fail safe to "task-detail", never throw or
// guess a resource.
export type TaskActionKind =
  | "application-review"
  | "opportunity-context"
  | "task-detail";

// review_application: the actual action (Approve / Needs Higher Care /
// Not Fit / Do Not Engage) happens on the specific Application's own show
// page (ApplicationShow.tsx, embedding ApplicationReviewActions) — never
// the Contact page.
const APPLICATION_REVIEW_TYPES: ReadonlySet<string> = new Set([
  "review_application",
]);

// sales_call, follow_up, nurture_follow_up, check_payment, send_contract,
// complete_access: every one of these is fundamentally "go work this
// Opportunity" — confirmed against current code, not assumed. DealShow.tsx
// (/deals/:id/show) is the one real screen that already embeds both the
// sales-call working context (DealSalesCallSection) and the application/
// enrollment context (DealApplicationAndEnrollment) an Opportunity has
// today. check_payment/send_contract/complete_access have no dedicated
// billing/contract/access-checklist screen yet — DealShow is the best
// truthful current destination for them too (not an invented one), and
// this policy's job is exactly to make swapping in a real screen later, if
// one gets built, a one-line change here rather than a Dashboard rewrite.
// sales_call_cancelled (GYU real-infrastructure slice, human-acceptance
// repair pass): only ever created against a specific, already-matched
// Opportunity (see cancelSalesCall.ts's ensureFollowUpIfStranded) — unlike
// resolve_sales_call below, there's no ambiguity to fall back on, so this
// belongs here too, not with the task-detail fallback types.
const OPPORTUNITY_CONTEXT_TYPES: ReadonlySet<string> = new Set([
  "sales_call",
  "follow_up",
  "nurture_follow_up",
  "check_payment",
  "send_contract",
  "complete_access",
  "sales_call_cancelled",
]);

// resolve_sales_call: resolveSalesCallTask.ts's own comment already says
// so explicitly — "no dedicated resolution page in this slice." "other"
// and any custom/unrecognized type: no type-specific destination exists to
// resolve. Both fall back to "task-detail" (open the Task's own edit view
// — the existing TaskEdit/TaskEditSheet already wired to Task.tsx's
// dropdown "Edit" action) rather than guessing or silently going nowhere.
export const classifyTaskActionKind = (
  taskType: string | null | undefined,
): TaskActionKind => {
  if (taskType && APPLICATION_REVIEW_TYPES.has(taskType)) {
    return "application-review";
  }
  if (taskType && OPPORTUNITY_CONTEXT_TYPES.has(taskType)) {
    return "opportunity-context";
  }
  return "task-detail";
};
