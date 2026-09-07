import { useGetList } from "ra-core";

import type { Application, Deal, SalesCall, Task } from "../types";
import { classifyTaskActionKind } from "./taskActionDestination";

export type TaskActionDestination =
  | { kind: "application-review"; to: string }
  | { kind: "opportunity-context"; to: string }
  | { kind: "enrollment-context"; to: string }
  | { kind: "resolve-sales-call"; to: string }
  | { kind: "resolve-client-session-cadence"; to: string }
  // No real, resolvable destination for this Task — either its type has no
  // dedicated action screen ("other", an unrecognized custom type) or the
  // record it would have pointed to no longer exists (deleted Contact/
  // Deal/Application/SalesCall, or a Contact with no Deal at all). The
  // caller's job is to open the Task's own edit view instead of guessing
  // or navigating nowhere.
  | { kind: "task-detail" };

// Same "not archived, not won, no exit outcome" definition already used at
// submitApplication.ts/waitlist/waitlistActions.ts for "is this Deal still
// an open pipeline item" — duplicated rather than imported since those are
// private, unexported helpers local to their own modules.
const isActiveDeal = (deal: Pick<Deal, "stage" | "outcome" | "archived_at">) =>
  deal.archived_at == null && deal.stage !== "won" && deal.outcome == null;

// Resolves WHERE a Task's primary action should navigate to, given only
// what Task itself durably stores today: contact_id (Native Applications
// slice, §19 / Acuity slice: adding a deal_id/application_id FK to Task
// would be a further schema change, deliberately deferred — see this
// module's own real-infrastructure audit report for why a heuristic is
// the right call for now, not a gap silently left unaddressed). A Contact
// with more than one matching Deal/Application resolves to the most
// recently created one; this matches every other Task-resolution helper's
// own documented heuristic (reviewApplicationTask.ts, salesCallTask.ts,
// resolveSalesCallTask.ts) rather than inventing a new convention. Never
// performs a write — this is read-only resolution for navigation, kept
// strictly separate from Task completion/postpone/status logic.
export const useTaskActionDestination = (
  task: Task,
): { destination: TaskActionDestination | null; isPending: boolean } => {
  const actionKind = classifyTaskActionKind(task.type);
  const isResolveSalesCall = actionKind === "resolve-sales-call";

  // Every hook below is called on EVERY render, unconditionally (Rules of
  // Hooks) — each one's own `enabled` flag is what actually gates it,
  // exactly like react-query/ra-core's own convention elsewhere. The
  // branching that decides which result actually matters for a given
  // `actionKind` happens AFTER all of them, never before — an early
  // `return` ahead of a hook call here previously skipped it for some
  // Task types but not others, a real conditional-hooks bug caught by
  // eslint's react-hooks/rules-of-hooks (not merely a style nit: it can
  // desync hook state across renders when a Task's `type` changes without
  // a full remount).

  // resolve-sales-call resolves off Task.sales_call_id when set (a real
  // FK, backfilled for pre-existing Tasks — see migration 20260904240000).
  // Falls back to a contact-scoped query only for the rare legacy Task the
  // backfill couldn't disambiguate: the Contact's own single still-
  // unresolved sales_call, if there is exactly one — never guessed when
  // there's more than one candidate.
  const needsSalesCallLookup =
    isResolveSalesCall && task.sales_call_id == null && task.contact_id != null;
  const { data: unresolvedSalesCalls, isPending: isPendingSalesCalls } =
    useGetList<SalesCall>(
      "sales_calls",
      {
        filter: {
          contact_id: task.contact_id,
          opportunity_id: null,
          dismissed_at: null,
        },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
      { enabled: needsSalesCallLookup, retry: false },
    );

  // enrollment-context and resolve-client-session-cadence (both real FKs,
  // resolved synchronously below with no query needed) and
  // resolve-sales-call never need this Deals lookup — excluded from
  // `needsDeals` the same way they were structurally unreachable before
  // this hook when both were early returns.
  const needsDeals =
    actionKind !== "task-detail" &&
    actionKind !== "enrollment-context" &&
    actionKind !== "resolve-client-session-cadence" &&
    !isResolveSalesCall &&
    task.contact_id != null;

  const { data: deals, isPending: isPendingDeals } = useGetList<Deal>(
    "deals",
    {
      filter: { contact_id: task.contact_id },
      pagination: { page: 1, perPage: 100 },
      sort: { field: "id", order: "DESC" },
    },
    // A failed resolution should fall back to "task-detail" immediately —
    // never retry-with-backoff for what's ultimately a non-critical
    // navigation affordance (react-query's default retries would only
    // delay that safe fallback, never improve it).
    { enabled: needsDeals, retry: false },
  );

  const dealIds = deals?.map((deal) => deal.id) ?? [];
  const wantsApplications =
    actionKind === "application-review" && dealIds.length > 0;
  const { data: applications, isPending: isPendingApplications } =
    useGetList<Application>(
      "applications",
      {
        filter: { "opportunity_id@in": `(${dealIds.join(",")})` },
        pagination: { page: 1, perPage: 100 },
        sort: { field: "id", order: "DESC" },
      },
      { enabled: wantsApplications, retry: false },
    );

  // resolve-client-session-cadence resolves DETERMINISTICALLY off
  // Task.cadence_issue_id — same reasoning as enrollment-context below,
  // never the contact_id heuristic every other kind still uses.
  if (actionKind === "resolve-client-session-cadence") {
    if (task.cadence_issue_id == null) {
      return { destination: { kind: "task-detail" }, isPending: false };
    }
    return {
      destination: {
        kind: "resolve-client-session-cadence",
        to: `/client-session-cadence/${task.cadence_issue_id}/resolve`,
      },
      isPending: false,
    };
  }

  // enrollment-context resolves DETERMINISTICALLY off Task.enrollment_id —
  // never the contact_id heuristic every other kind below still uses.
  if (actionKind === "enrollment-context") {
    if (task.enrollment_id == null) {
      return { destination: { kind: "task-detail" }, isPending: false };
    }
    return {
      destination: {
        kind: "enrollment-context",
        to: `/enrollments/${task.enrollment_id}/show`,
      },
      isPending: false,
    };
  }

  if (isResolveSalesCall) {
    if (task.sales_call_id != null) {
      return {
        destination: {
          kind: "resolve-sales-call",
          to: `/sales-calls/${task.sales_call_id}/resolve`,
        },
        isPending: false,
      };
    }
    if (needsSalesCallLookup && isPendingSalesCalls) {
      return { destination: null, isPending: true };
    }
    if (unresolvedSalesCalls?.length === 1) {
      return {
        destination: {
          kind: "resolve-sales-call",
          to: `/sales-calls/${unresolvedSalesCalls[0].id}/resolve`,
        },
        isPending: false,
      };
    }
    return { destination: { kind: "task-detail" }, isPending: false };
  }

  if (actionKind === "task-detail") {
    return { destination: { kind: "task-detail" }, isPending: false };
  }

  if (isPendingDeals) {
    return { destination: null, isPending: true };
  }

  if (actionKind === "application-review") {
    if (dealIds.length === 0) {
      return { destination: { kind: "task-detail" }, isPending: false };
    }
    if (isPendingApplications) {
      return { destination: null, isPending: true };
    }
    const pending = applications?.find((app) => app.status === "pending");
    const target = pending ?? applications?.[0];
    if (!target) {
      return { destination: { kind: "task-detail" }, isPending: false };
    }
    return {
      destination: {
        kind: "application-review",
        to: `/applications/${target.id}/show`,
      },
      isPending: false,
    };
  }

  // opportunity-context
  const activeDeal = deals?.find(isActiveDeal) ?? deals?.[0];
  if (!activeDeal) {
    return { destination: { kind: "task-detail" }, isPending: false };
  }
  return {
    destination: {
      kind: "opportunity-context",
      to: `/deals/${activeDeal.id}/show`,
    },
    isPending: false,
  };
};
