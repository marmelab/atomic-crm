import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb } from "@/test/StoryWrapper";
import type { Enrollment, EnrollmentOnboardingItem } from "../types";
import { activateEnrollment } from "./activateEnrollment";

const ENROLLMENT_ID = 1;

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: ENROLLMENT_ID,
  opportunity_id: 1,
  status: "onboarding",
  start_date: null,
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildItem = (
  overrides: Partial<EnrollmentOnboardingItem>,
): EnrollmentOnboardingItem => ({
  id: overrides.id ?? 1,
  enrollment_id: ENROLLMENT_ID,
  requirement_key: "contract",
  label: "Contract signed",
  task_text_template: "Send contract to {name}",
  is_required: true,
  sort_order: 1,
  status: "pending",
  completed_at: null,
  external_ref: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  enrollment: Enrollment,
  items: EnrollmentOnboardingItem[],
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      enrollments: [enrollment],
      enrollment_onboarding_items: items,
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("activateEnrollment", () => {
  it("rejects activation while a required item is incomplete, naming it", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment(), [
      buildItem({ id: 1, requirement_key: "contract", status: "pending" }),
      buildItem({ id: 2, requirement_key: "slack_access", status: "done" }),
    ]);

    const result = await activateEnrollment(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({
      applied: false,
      reason: "requirements-incomplete",
      missingKeys: ["contract"],
    });

    const { data: enrollment } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    expect(enrollment.status).toBe("onboarding");
  });

  it("activates once every required item is done — optional items never block it", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment(), [
      buildItem({ id: 1, requirement_key: "contract", status: "done" }),
      buildItem({
        id: 2,
        requirement_key: "optional_extra",
        is_required: false,
        status: "pending",
      }),
    ]);

    const result = await activateEnrollment(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({ applied: true });

    const { data: enrollment } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    expect(enrollment.status).toBe("active");
  });

  it("is idempotent — activating an already-active Enrollment is a safe no-op, never a second write", async () => {
    const { dataProvider } = buildFixtures(
      buildEnrollment({ status: "active" }),
      [buildItem({ id: 1, status: "done" })],
    );

    const result = await activateEnrollment(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({ applied: false, reason: "not-onboarding" });
  });

  it("the DB-level guard (FakeRest mirror) rejects a direct status write too, not just the domain function's own check", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment(), [
      buildItem({ id: 1, status: "pending" }),
    ]);

    await expect(
      dataProvider.update("enrollments", {
        id: ENROLLMENT_ID,
        data: { status: "active" },
        previousData: buildEnrollment(),
      }),
    ).rejects.toThrow();
  });
});
