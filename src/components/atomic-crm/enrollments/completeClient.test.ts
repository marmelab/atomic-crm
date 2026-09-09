import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb } from "@/test/StoryWrapper";
import type { Enrollment, EnrollmentOffboardingItem } from "../types";
import { completeClient } from "./completeClient";

const ENROLLMENT_ID = 1;

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: ENROLLMENT_ID,
  opportunity_id: 1,
  status: "offboarding",
  start_date: "2026-01-01",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildItem = (
  overrides: Partial<EnrollmentOffboardingItem>,
): EnrollmentOffboardingItem => ({
  id: overrides.id ?? 1,
  enrollment_id: ENROLLMENT_ID,
  requirement_key: "notes_archived",
  label: "Session notes archived",
  task_text_template: "Move {name}'s session notes to Past Clients",
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
  items: EnrollmentOffboardingItem[],
) => {
  const dataProvider = createDataProvider({
    db: createCrmDb({
      enrollments: [enrollment],
      enrollment_offboarding_items: items,
    }),
    silent: true,
    latency: 0,
  });
  return { dataProvider };
};

describe("completeClient", () => {
  it("rejects completion while a required item is incomplete, naming it", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment(), [
      buildItem({
        id: 1,
        requirement_key: "notes_archived",
        status: "pending",
      }),
      buildItem({ id: 2, requirement_key: "slack_removed", status: "done" }),
    ]);

    const result = await completeClient(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({
      applied: false,
      reason: "requirements-incomplete",
      missingKeys: ["notes_archived"],
    });

    const { data: enrollment } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    expect(enrollment.status).toBe("offboarding");
  });

  it("completes once every required item is done — optional items never block it", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment(), [
      buildItem({ id: 1, requirement_key: "notes_archived", status: "done" }),
      buildItem({
        id: 2,
        requirement_key: "optional_extra",
        is_required: false,
        status: "pending",
      }),
    ]);

    const result = await completeClient(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({ applied: true });

    const { data: enrollment } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    expect(enrollment.status).toBe("completed");
  });

  it("is idempotent — completing an already-completed Enrollment is a safe no-op, never a second write", async () => {
    const { dataProvider } = buildFixtures(
      buildEnrollment({ status: "completed" }),
      [buildItem({ id: 1, status: "done" })],
    );

    const result = await completeClient(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({ applied: false, reason: "not-offboarding" });
  });

  it("rejects completing a still-active Enrollment — offboarding cannot be skipped", async () => {
    const { dataProvider } = buildFixtures(
      buildEnrollment({ status: "active" }),
      [buildItem({ id: 1, status: "done" })],
    );

    const result = await completeClient(dataProvider, ENROLLMENT_ID);
    expect(result).toEqual({ applied: false, reason: "not-offboarding" });

    const { data: enrollment } = await dataProvider.getOne<Enrollment>(
      "enrollments",
      { id: ENROLLMENT_ID },
    );
    expect(enrollment.status).toBe("active");
  });

  it("the DB-level guard (FakeRest mirror) rejects a direct status write with incomplete items too", async () => {
    const { dataProvider } = buildFixtures(buildEnrollment(), [
      buildItem({ id: 1, status: "pending" }),
    ]);

    await expect(
      dataProvider.update("enrollments", {
        id: ENROLLMENT_ID,
        data: { status: "completed" },
        previousData: buildEnrollment(),
      }),
    ).rejects.toThrow();
  });

  it("the DB-level lifecycle-sequence guard (FakeRest mirror) rejects a direct active -> completed skip", async () => {
    const { dataProvider } = buildFixtures(
      buildEnrollment({ status: "active" }),
      [buildItem({ id: 1, status: "done" })],
    );

    await expect(
      dataProvider.update("enrollments", {
        id: ENROLLMENT_ID,
        data: { status: "completed" },
        previousData: buildEnrollment({ status: "active" }),
      }),
    ).rejects.toThrow();
  });
});
