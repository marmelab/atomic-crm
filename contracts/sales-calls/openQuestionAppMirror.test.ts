// @vitest-environment node
import { describe, expect, it } from "vitest";

import {
  salesCallTaskQuestion,
  TASK_TYPE_FOR_QUESTION,
} from "../../src/components/atomic-crm/sales-calls/salesCallTaskTypes";
import type { SalesCall } from "../../src/components/atomic-crm/types";
import vectors from "./openQuestionVectors.json";

// The APP arm of the cross-runtime agreement.
//
// Same vectors, same fixed `now`, three runtimes:
//   database — e2e/salesCallOpenQuestionDatabase.spec.ts
//   app      — this file
//   edge     — supabase/functions/acuity_webhook/acuityOpenQuestionAgreement.test.ts
//
// The database is the authority; this is the mirror, the same arrangement
// isActiveDeal has with deal_is_active. What makes the arrangement safe is
// not that the mirror is careful — the Acuity handler's mirror was careful
// too, right up until migration 20260918030000 moved underneath it — but
// that all three are held to ONE checked-in set of cases. Drift in any arm
// now fails a test instead of reaching Leif's Dashboard.

const NOW = new Date(vectors.now);

const asSalesCall = (call: (typeof vectors.vectors)[number]["call"]) =>
  call as unknown as Parameters<typeof salesCallTaskQuestion>[0];

describe("sales call open question — app mirror agrees with the canonical vectors", () => {
  it("evaluates every vector at the canonical instant", () => {
    expect(vectors.vectors.length).toBeGreaterThan(0);
    expect(Number.isNaN(NOW.getTime())).toBe(false);
  });

  it.each(
    vectors.vectors.map(
      (vector) => [vector.id, vector.expected_question, vector] as const,
    ),
  )("%s -> %s", (_id, expected, vector) => {
    expect(
      salesCallTaskQuestion(asSalesCall(vector.call), NOW),
      vector.description,
    ).toBe(expected);
  });

  it.each(
    vectors.vectors.map(
      (vector) => [vector.id, vector.expected_question, vector] as const,
    ),
  )(
    "%s asks its question with the Task type the contract names (%s)",
    (_id, expected, _vector) => {
      const expectedType =
        vectors.task_type_for_question[
          expected as keyof typeof vectors.task_type_for_question
        ];
      if (expected === "none") {
        expect(expectedType).toBeNull();
        return;
      }
      expect(
        TASK_TYPE_FOR_QUESTION[expected as "matching" | "attendance"],
      ).toBe(expectedType);
    },
  );

  // The specific falsehood this whole slice exists to keep out: an
  // attendance question about a call that has not happened.
  it("never asks what happened on a call in the future", () => {
    const futureAttendance = vectors.vectors.filter((vector) => {
      const question = salesCallTaskQuestion(asSalesCall(vector.call), NOW);
      if (question !== "attendance") return false;
      const scheduledAt = vector.call.scheduled_at;
      return scheduledAt != null && new Date(scheduledAt) > NOW;
    });
    expect(futureAttendance.map((vector) => vector.id)).toEqual([]);
  });

  it("never infers attendance from a missing attendance value alone", () => {
    const vector = vectors.vectors.find(
      (candidate) => candidate.id === "past-attached-no-resolution-requested",
    );
    expect(vector, "the 109-imported-calls vector is missing").toBeDefined();
    expect(salesCallTaskQuestion(asSalesCall(vector!.call), NOW)).toBe("none");
  });
});

// A narrow guard on the shape of the SalesCall fields the mirror reads, so
// a rename in types.ts cannot quietly turn every vector into `undefined`
// and still pass.
describe("the vectors speak the column names sales_calls actually has", () => {
  const COLUMNS: (keyof SalesCall)[] = [
    "opportunity_id",
    "dismissed_at",
    "status",
    "attendance",
    "scheduled_at",
    "scheduled_on",
    "resolution_requested_at",
  ];

  it.each(vectors.vectors.map((vector) => [vector.id, vector] as const))(
    "%s names every field the classifier reads",
    (_id, vector) => {
      expect(Object.keys(vector.call).sort()).toEqual(
        [...COLUMNS].map(String).sort(),
      );
    },
  );
});
