import { beforeEach, describe, expect, test } from "vitest";

import type { Application, Deal, Enrollment, Offer } from "../../types";
import { createDataProvider } from "./dataProvider";
import generateData from "./dataGenerator";
import { SEPTEMBER_GYU_COHORT_ID } from "./dataGenerator/cohorts";
import { GYU_OFFER_ID, LIVING_EXAMPLE_OFFER_ID } from "./dataGenerator/offers";
import type { Db } from "./dataGenerator/types";

let db: Db;
let dataProvider: ReturnType<typeof createDataProvider>;

beforeEach(() => {
  db = generateData();
  dataProvider = createDataProvider({ db, latency: 0, silent: true });
});

const createOpportunity = (overrides: Partial<Deal> = {}) =>
  dataProvider.create<Deal>("deals", {
    data: {
      name: "Test Opportunity",
      contact_id: db.contacts[0]!.id,
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      stage: "interested",
      amount: 4000,
      sales_id: db.sales[0]!.id,
      expected_closing_date: "2026-12-31",
      index: 0,
      ...overrides,
    },
  });

describe("Offer <-> Cohort relationship", () => {
  test("an individual Opportunity works without a Cohort", async () => {
    const { data } = await createOpportunity({
      offer_id: LIVING_EXAMPLE_OFFER_ID,
      cohort_id: null,
    });
    expect(data.offer_id).toBe(LIVING_EXAMPLE_OFFER_ID);
    expect(data.cohort_id).toBeFalsy();
  });

  test("a group Opportunity can reference its offer's Cohort", async () => {
    const { data } = await createOpportunity({
      offer_id: GYU_OFFER_ID,
      cohort_id: SEPTEMBER_GYU_COHORT_ID,
    });
    expect(data.cohort_id).toBe(SEPTEMBER_GYU_COHORT_ID);
  });

  test("rejects a Cohort on an individual offer", async () => {
    await expect(
      createOpportunity({
        offer_id: LIVING_EXAMPLE_OFFER_ID,
        cohort_id: SEPTEMBER_GYU_COHORT_ID,
      }),
    ).rejects.toThrow();
  });

  test("rejects a Cohort that belongs to a different offer", async () => {
    const { data: otherOffer } = await dataProvider.create<Offer>("offers", {
      data: {
        name: "Some Other Group Offer",
        type: "group",
        duration: "6 weeks",
        current_price: 500,
        is_active: true,
      },
    });
    const { data: otherCohort } = await dataProvider.create("cohorts", {
      data: { offer_id: otherOffer.id, name: "Other Cohort", status: "draft" },
    });

    await expect(
      createOpportunity({
        offer_id: GYU_OFFER_ID,
        cohort_id: otherCohort.id,
      }),
    ).rejects.toThrow();
  });
});

describe("commercial snapshot", () => {
  test("snapshots the offer name and price at creation time", async () => {
    const { data } = await createOpportunity({ offer_id: GYU_OFFER_ID });
    expect(data.offer_name_snapshot).toBe("Growing Yourself Up");
    expect(data.offer_price_snapshot).toBe(1400);
  });

  test("survives a later change to the Offer's current price", async () => {
    const { data: opportunity } = await createOpportunity({
      offer_id: LIVING_EXAMPLE_OFFER_ID,
    });
    expect(opportunity.offer_price_snapshot).toBe(4000);

    const { data: offer } = await dataProvider.getOne<Offer>("offers", {
      id: LIVING_EXAMPLE_OFFER_ID,
    });
    await dataProvider.update("offers", {
      id: LIVING_EXAMPLE_OFFER_ID,
      data: { current_price: 5000 },
      previousData: offer,
    });

    const { data: reloaded } = await dataProvider.getOne<Deal>("deals", {
      id: opportunity.id,
    });
    expect(reloaded.offer_price_snapshot).toBe(4000);
  });
});

describe("Won -> Enrollment lifecycle", () => {
  test("creates exactly one Enrollment when an Opportunity is genuinely Won", async () => {
    const { data: opportunity } = await createOpportunity();
    await dataProvider.update("deals", {
      id: opportunity.id,
      data: { stage: "won" },
      previousData: opportunity,
    });

    const { total } = await dataProvider.getList<Enrollment>("enrollments", {
      filter: { opportunity_id: opportunity.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  test("does not create a duplicate Enrollment on a later, unrelated update", async () => {
    const { data: opportunity } = await createOpportunity();
    const { data: won } = await dataProvider.update<Deal>("deals", {
      id: opportunity.id,
      data: { stage: "won" },
      previousData: opportunity,
    });
    await dataProvider.update("deals", {
      id: won.id,
      data: { description: "Some note added after Won" },
      previousData: won,
    });

    const { total } = await dataProvider.getList<Enrollment>("enrollments", {
      filter: { opportunity_id: opportunity.id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });

  test("derives GYU Enrollment dates from the Cohort's program dates", async () => {
    const { data: opportunity } = await createOpportunity({
      offer_id: GYU_OFFER_ID,
      cohort_id: SEPTEMBER_GYU_COHORT_ID,
    });
    await dataProvider.update("deals", {
      id: opportunity.id,
      data: { stage: "won" },
      previousData: opportunity,
    });

    const { data: enrollments } = await dataProvider.getList<Enrollment>(
      "enrollments",
      {
        filter: { opportunity_id: opportunity.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    const cohort = db.cohorts.find((c) => c.id === SEPTEMBER_GYU_COHORT_ID)!;
    expect(enrollments[0]!.start_date).toBe(
      cohort.program_start_at!.split("T")[0],
    );
    expect(enrollments[0]!.end_date).toBe(cohort.program_end_at!.split("T")[0]);
  });
});

describe("Application status vs. Owner decision independence", () => {
  test("changing owner_decision does not touch the Application's status", async () => {
    const { data: opportunity } = await createOpportunity();
    const { data: application } = await dataProvider.create<Application>(
      "applications",
      {
        data: {
          opportunity_id: opportunity.id,
          status: "pending",
          submitted_at: new Date().toISOString(),
          raw_answers: {},
        },
      },
    );

    await dataProvider.update("deals", {
      id: opportunity.id,
      data: { owner_decision: "would_work_with" },
      previousData: opportunity,
    });

    const { data: reloaded } = await dataProvider.getOne<Application>(
      "applications",
      { id: application.id },
    );
    expect(reloaded.status).toBe("pending");
  });

  test("approving an Application does not touch the Opportunity's owner_decision", async () => {
    const { data: opportunity } = await createOpportunity();
    const { data: application } = await dataProvider.create<Application>(
      "applications",
      {
        data: {
          opportunity_id: opportunity.id,
          status: "pending",
          submitted_at: new Date().toISOString(),
          raw_answers: {},
        },
      },
    );

    await dataProvider.update("applications", {
      id: application.id,
      data: { status: "approved" },
      previousData: application,
    });

    const { data: reloaded } = await dataProvider.getOne<Deal>("deals", {
      id: opportunity.id,
    });
    expect(reloaded.owner_decision).toBeFalsy();
  });
});
