import type { DataProvider } from "ra-core";

import type { Application, ApplicationStatus, Deal } from "../types";
import { completeReviewApplicationTask } from "./reviewApplicationTask";

export type ApplicationReviewOutcome = Exclude<ApplicationStatus, "pending">;

export type ReviewApplicationResult =
  | { applied: true }
  | { applied: false; reason: "already-reviewed" };

// Centralizes every write an Application review decision requires across
// Application / Opportunity / Contact / Task (Native Applications slice,
// §19 — the UI calls this trustworthy domain operation, business rules
// never live in a button's onClick). Idempotent: re-running against an
// Application that is no longer "pending" is a safe no-op rather than a
// second write, so a double-click, a cached tab, or Back/Forward can never
// silently overwrite a newer decision (§17.F/G) — the caller checks
// `applied` and tells the user rather than assuming success. The pending
// check re-fetches the Application rather than trusting the caller's
// `application` argument: a stale UI's copy of that argument is exactly as
// stale as what it's meant to guard against, so only the server's current
// state can actually detect "someone else already reviewed this".
export const reviewApplication = async ({
  dataProvider,
  application,
  deal,
  outcome,
}: {
  dataProvider: DataProvider;
  application: Pick<Application, "id">;
  deal: Pick<
    Deal,
    "id" | "contact_id" | "stage" | "outcome" | "owner_decision"
  >;
  outcome: ApplicationReviewOutcome;
}): Promise<ReviewApplicationResult> => {
  const { data: currentApplication } = await dataProvider.getOne<Application>(
    "applications",
    { id: application.id },
  );
  if (currentApplication.status !== "pending") {
    return { applied: false, reason: "already-reviewed" };
  }

  const { data: currentDeal } = await dataProvider.getOne<Deal>("deals", {
    id: deal.id,
  });

  const reviewedAt = new Date().toISOString();

  await dataProvider.update("applications", {
    id: currentApplication.id,
    data: { status: outcome, reviewed_at: reviewedAt },
    previousData: currentApplication,
  });

  await dataProvider.update("deals", {
    id: currentDeal.id,
    data: buildDealUpdate(outcome),
    previousData: currentDeal,
  });

  if (outcome === "do_not_engage") {
    const { data: contact } = await dataProvider.getOne("contacts", {
      id: currentDeal.contact_id,
    });
    await dataProvider.update("contacts", {
      id: currentDeal.contact_id,
      data: { sales_eligibility: "do_not_engage" },
      previousData: contact,
    });
  }

  // Review Application completes automatically on any outcome (§4-§7) —
  // never the reverse (see reviewApplicationTask.ts).
  await completeReviewApplicationTask(
    dataProvider,
    currentDeal.contact_id,
    reviewedAt,
  );

  return { applied: true };
};

const buildDealUpdate = (outcome: ApplicationReviewOutcome): Partial<Deal> => {
  switch (outcome) {
    case "approved":
      // "Qualified enough for a sales call" — the pipeline moves forward;
      // final personal fit is still undecided (§1/§4). outcome stays null,
      // explicitly re-asserted here in case a prior review round set one.
      return { stage: "approved", outcome: null };
    case "needs_higher_care":
      return { outcome: "needs_higher_care" };
    case "not_fit":
      return { outcome: "not_fit" };
    case "do_not_engage":
      // No 'do_not_engage' Opportunity outcome exists in the schema, and
      // none is needed: the Contact-level sales_eligibility flag above is
      // the durable signal. This Opportunity exits the active pipeline
      // like any other decline (outcome: 'lost'), with the existing
      // owner_decision field recording the specific reason (§7) — reusing
      // established Opportunity-level architecture rather than inventing
      // a new outcome value for one case.
      return { outcome: "lost", owner_decision: "do_not_engage" };
  }
};
