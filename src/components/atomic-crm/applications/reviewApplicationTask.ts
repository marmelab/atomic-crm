import type { DataProvider, Identifier } from "ra-core";

import type { Task } from "../types";

const REVIEW_APPLICATION_TASK_TYPE = "review_application";

// Task's only link to a Contact is `contact_id` — there is no
// opportunity_id/application_id FK on Task (Native Applications slice,
// §19: adding one would be a second schema change beyond the one already
// agreed for this slice). This matches "the" pending review task for a
// Contact heuristically: correct for the product's normal one-application-
// at-a-time pattern. Known limitation: if a Contact ever has two
// concurrently pending Applications, this resolves to whichever such task
// was created first, not necessarily the one for the Application just
// reviewed.
export const findPendingReviewApplicationTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
): Promise<Task | null> => {
  const { data } = await dataProvider.getList<Task>("tasks", {
    filter: { contact_id: contactId, type: REVIEW_APPLICATION_TASK_TYPE },
    pagination: { page: 1, perPage: 50 },
    sort: { field: "id", order: "ASC" },
  });
  return data.find((task) => !task.done_date) ?? null;
};

// Creates the "Review Application" task for a newly pending Application,
// unless one already exists for this Contact (§8: one pending task per
// pending Application, never a duplicate).
export const ensureReviewApplicationTask = async (
  dataProvider: DataProvider,
  {
    contactId,
    applicantName,
    salesId,
  }: {
    contactId: Identifier;
    applicantName: string;
    salesId?: Identifier | null;
  },
): Promise<void> => {
  const existing = await findPendingReviewApplicationTask(
    dataProvider,
    contactId,
  );
  if (existing) return;

  await dataProvider.create("tasks", {
    data: {
      contact_id: contactId,
      type: REVIEW_APPLICATION_TASK_TYPE,
      text: `Review ${applicantName}'s application`,
      due_date: new Date().toISOString(),
      status: "pending",
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });
};

// Completing the review is what completes the task — never the reverse
// (§8: a Task only represents work to do; completing it manually must
// never change Application status, and this function is the only writer
// that flips done_date on a review_application task from application
// review).
export const completeReviewApplicationTask = async (
  dataProvider: DataProvider,
  contactId: Identifier,
  completedAt: string,
): Promise<void> => {
  const task = await findPendingReviewApplicationTask(dataProvider, contactId);
  if (!task) return;

  await dataProvider.update("tasks", {
    id: task.id,
    // done_date/status are set together explicitly rather than relying on
    // FakeRest's done_date -> status sync hook, since the real Supabase
    // provider has no equivalent trigger (see reviewApplication.ts).
    data: { done_date: completedAt, status: "completed" },
    previousData: task,
  });
};
