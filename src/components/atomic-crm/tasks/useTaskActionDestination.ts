import { useGetList } from "ra-core";

import type { Application, Deal, Task } from "../types";
import { classifyTaskActionKind } from "./taskActionDestination";

export type TaskActionDestination =
  | { kind: "application-review"; to: string }
  | { kind: "opportunity-context"; to: string }
  // No real, resolvable destination for this Task — either its type has no
  // dedicated action screen (resolve_sales_call, other, an unrecognized
  // custom type) or the record it would have pointed to no longer exists
  // (deleted Contact/Deal/Application, or a Contact with no Deal at all).
  // The caller's job is to open the Task's own edit view instead of
  // guessing or navigating nowhere.
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
  const needsDeals = actionKind !== "task-detail" && task.contact_id != null;

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
