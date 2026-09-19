import { describe, expect, test } from "vitest";

import type { Application, Deal } from "../types";
import { reviewTiming } from "./applicationReviewSla";
import { isActiveOpportunity } from "../deals/dealActivity";

// Two separate questions, deliberately:
//
//   is this current review work?      -> the Applications for Review queue
//   has it been waiting too long?     -> a Needs Attention escalation
//
// The old model answered only the first and then treated it as the second,
// which is why a brand-new applicant appeared as overdue.

const deal = (overrides: Partial<Deal> = {}): Deal =>
  ({
    id: 1,
    name: "Someone",
    contact_id: 1,
    offer_id: 1,
    stage: "application_received",
    outcome: null,
    archived_at: null,
    ...overrides,
  }) as Deal;

const application = (overrides: Partial<Application> = {}): Application =>
  ({
    id: 1,
    contact_id: 1,
    offer_id: 1,
    opportunity_id: 1,
    status: "pending",
    submitted_at: "2026-09-18T18:00:00Z",
    raw_answers: {},
    ...overrides,
  }) as Application;

// The canonical condition, as the view and the queue both apply it.
const isAwaitingReview = (app: Application, opportunity: Deal | undefined) =>
  app.status === "pending" &&
  app.opportunity_id != null &&
  opportunity != null &&
  isActiveOpportunity(opportunity) &&
  opportunity.stage === "application_received";

describe("what counts as current review work", () => {
  test("pending on a live attempt awaiting a decision", () => {
    expect(isAwaitingReview(application(), deal())).toBe(true);
  });

  test("a historical pending Application on a finished attempt does not", () => {
    // Arrange — this is the shape of nearly all 99 pending Applications:
    // recovered history whose sales attempt ended long ago. Pending on a
    // dead attempt is stale information, not a job.
    const finished = deal({ stage: "interested", outcome: "nurture" });

    // Assert
    expect(isActiveOpportunity(finished)).toBe(false);
    expect(isAwaitingReview(application(), finished)).toBe(false);
  });

  test("a live attempt that has moved past review does not", () => {
    // Arrange — they were approved and a call was booked; the pending
    // status is stale, and rewriting it without evidence is not this
    // slice's business.
    expect(
      isAwaitingReview(application(), deal({ stage: "call_booked" })),
    ).toBe(false);
  });

  test("an unlinked Application does not", () => {
    // Arrange — 78 Applications have no Opportunity at all.
    expect(
      isAwaitingReview(application({ opportunity_id: null }), undefined),
    ).toBe(false);
  });

  test("a reviewed Application leaves the queue", () => {
    expect(isAwaitingReview(application({ status: "approved" }), deal())).toBe(
      false,
    );
  });
});

describe("when it becomes an escalation", () => {
  // An escalation exists only while the Application is BOTH current work
  // and past its window — the two conditions the reconcile function ANDs
  // together.
  const needsEscalation = (
    app: Application,
    opportunity: Deal | undefined,
    now: string,
  ) =>
    isAwaitingReview(app, opportunity) &&
    reviewTiming(app.submitted_at, now).state === "overdue";

  test("no escalation inside the three-day window", () => {
    // Arrange — day 0 through day 3.
    for (const day of [0, 1, 2, 3]) {
      const now = `2026-09-${18 + day}T18:00:00Z`;
      // Assert
      expect(needsEscalation(application(), deal(), now), `day ${day}`).toBe(
        false,
      );
    }
  });

  test("exactly one escalation from day four", () => {
    // Assert
    expect(needsEscalation(application(), deal(), "2026-09-22T18:00:00Z")).toBe(
      true,
    );
  });

  test("an overdue Application stays IN the review queue as well", () => {
    // Arrange — the duplication is intentional: being late does not mean
    // the work went somewhere else.
    const now = "2026-09-25T18:00:00Z";

    // Assert
    expect(isAwaitingReview(application(), deal())).toBe(true);
    expect(needsEscalation(application(), deal(), now)).toBe(true);
  });

  test("a stale historical pending Application never escalates, however old", () => {
    // Arrange — years past its window, but its attempt is finished. This
    // is what stops 99 recovered records becoming 99 exceptions.
    const ancient = application({ submitted_at: "2026-01-01T00:00:00Z" });
    const finished = deal({ stage: "interested", outcome: "lost" });

    // Assert
    expect(
      reviewTiming(ancient.submitted_at, "2026-09-25T18:00:00Z").state,
    ).toBe("overdue");
    expect(needsEscalation(ancient, finished, "2026-09-25T18:00:00Z")).toBe(
      false,
    );
  });

  test("reviewing it removes both the queue row and the escalation", () => {
    // Arrange — one state change, both consequences.
    const reviewed = application({ status: "approved" });
    const now = "2026-09-25T18:00:00Z";

    // Assert
    expect(isAwaitingReview(reviewed, deal())).toBe(false);
    expect(needsEscalation(reviewed, deal(), now)).toBe(false);
  });

  test("an overdue Application put back to pending escalates again", () => {
    // Arrange — the projection follows the condition, so the Task returns
    // rather than the correction being silently lost.
    const reopened = application({ status: "pending" });

    // Assert
    expect(needsEscalation(reopened, deal(), "2026-09-25T18:00:00Z")).toBe(
      true,
    );
  });
});
