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
  | "enrollment-context"
  | "resolve-sales-call"
  | "resolve-client-session-cadence"
  | "task-detail";

// review_application: the actual action (Approve / Needs Higher Care /
// Not Fit / Do Not Engage) happens on the specific Application's own show
// page (ApplicationShow.tsx, embedding ApplicationReviewActions) — never
// the Contact page.
const APPLICATION_REVIEW_TYPES: ReadonlySet<string> = new Set([
  "review_application",
]);

// sales_call, follow_up, nurture_follow_up, check_payment: every one of
// these is fundamentally "go work this Opportunity" — confirmed against
// current code, not assumed. DealShow.tsx (/deals/:id/show) is the one
// real screen that already embeds both the sales-call working context
// (DealSalesCallSection) and the application/enrollment context
// (DealApplicationAndEnrollment) an Opportunity has today. check_payment
// has no dedicated billing screen yet — DealShow is the best truthful
// current destination for it too (not an invented one), and this policy's
// job is exactly to make swapping in a real screen later, if one gets
// built, a one-line change here rather than a Dashboard rewrite.
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
  "sales_call_cancelled",
]);

// onboarding_item (Contracts + Onboarding slice): retires send_contract/
// complete_access, which used to live in OPPORTUNITY_CONTEXT_TYPES above —
// wrong even when they were added, since "go work this Opportunity" was
// never actually true for post-Won client-delivery work. This type
// resolves DETERMINISTICALLY via Task.enrollment_id (a real FK, set by
// handle_deal_won() at creation) rather than the contact_id heuristic
// every OPPORTUNITY_CONTEXT_TYPES/APPLICATION_REVIEW_TYPES type still
// uses below — see useTaskActionDestination.ts.
// Client Offboarding slice: offboarding_item joins onboarding_item here
// for the same reason — resolves DETERMINISTICALLY via Task.enrollment_id
// too, no separate resolution logic needed.
const ENROLLMENT_CONTEXT_TYPES: ReadonlySet<string> = new Set([
  "onboarding_item",
  "offboarding_item",
]);

// resolve_sales_call (Unmatched Sales Call Resolution slice): used to fall
// back to "task-detail" (the generic Edit sheet) — genuinely not useful
// there, since the actual question ("what Opportunity does this booking
// belong to?") isn't answerable from Description/Due date/Type/Status.
// Resolves DETERMINISTICALLY via Task.sales_call_id (set at creation,
// backfilled for pre-existing rows — see migration 20260904240000) to a
// dedicated resolution page, never the generic modal — see
// useTaskActionDestination.ts.
const RESOLVE_SALES_CALL_TYPES: ReadonlySet<string> = new Set([
  "resolve_sales_call",
]);

// resolve_client_session_cadence (Client + Session Operations cadence
// correction): same "no generic Edit sheet" reasoning as
// resolve_sales_call above — the actual question ("known skip,
// rescheduled, or missed/ghosted?") isn't answerable from Description/Due
// date/Type/Status either. Resolves DETERMINISTICALLY via
// Task.cadence_issue_id (always set at creation — no legacy fallback
// needed, unlike sales_call_id's) to its own dedicated resolution page.
const RESOLVE_CLIENT_SESSION_CADENCE_TYPES: ReadonlySet<string> = new Set([
  "resolve_client_session_cadence",
]);

// "other" and any custom/unrecognized type: no type-specific destination
// exists to resolve. Falls back to "task-detail" (open the Task's own edit
// view — the existing TaskEdit/TaskEditSheet already wired to Task.tsx's
// dropdown "Edit" action) rather than guessing or silently going nowhere.
export const classifyTaskActionKind = (
  taskType: string | null | undefined,
): TaskActionKind => {
  if (taskType && APPLICATION_REVIEW_TYPES.has(taskType)) {
    return "application-review";
  }
  if (taskType && ENROLLMENT_CONTEXT_TYPES.has(taskType)) {
    return "enrollment-context";
  }
  if (taskType && RESOLVE_SALES_CALL_TYPES.has(taskType)) {
    return "resolve-sales-call";
  }
  if (taskType && RESOLVE_CLIENT_SESSION_CADENCE_TYPES.has(taskType)) {
    return "resolve-client-session-cadence";
  }
  if (taskType && OPPORTUNITY_CONTEXT_TYPES.has(taskType)) {
    return "opportunity-context";
  }
  return "task-detail";
};
