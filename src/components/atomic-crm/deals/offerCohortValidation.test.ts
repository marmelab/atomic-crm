import { describe, expect, test } from "vitest";
import {
  OfferCohortMismatchError,
  validateOfferCohort,
} from "./offerCohortValidation";

describe("validateOfferCohort", () => {
  test("allows an individual offer with no cohort", () => {
    expect(() =>
      validateOfferCohort({ id: 1, type: "individual" }, null),
    ).not.toThrow();
  });

  test("allows a group offer with a matching cohort", () => {
    expect(() =>
      validateOfferCohort({ id: 2, type: "group" }, { id: 10, offer_id: 2 }),
    ).not.toThrow();
  });

  test("rejects a cohort on an individual offer", () => {
    expect(() =>
      validateOfferCohort(
        { id: 1, type: "individual" },
        { id: 10, offer_id: 1 },
      ),
    ).toThrow(OfferCohortMismatchError);
  });

  test("rejects a cohort that belongs to a different offer", () => {
    expect(() =>
      validateOfferCohort({ id: 2, type: "group" }, { id: 10, offer_id: 3 }),
    ).toThrow(OfferCohortMismatchError);
  });
});
