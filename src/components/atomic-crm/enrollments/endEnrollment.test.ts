import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb } from "@/test/StoryWrapper";
import type {
  Enrollment,
  EnrollmentOffboardingItem,
  EnrollmentStatusEvent,
} from "../types";
import { endEnrollment } from "./endEnrollment";
import { classifyEnrollment } from "./classifyEnrollment";

const ENROLLMENT_ID = 1;

const buildEnrollment = (overrides: Partial<Enrollment> = {}): Enrollment => ({
  id: ENROLLMENT_ID,
  opportunity_id: 1,
  onboarding_tracking: "tracked" as const,
  status: "active",
  start_date: "2026-01-05",
  end_date: null,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

const buildFixtures = (
  enrollment: Enrollment,
  offboardingItems: EnrollmentOffboardingItem[] = [],
) => ({
  dataProvider: createDataProvider({
    db: createCrmDb({
      enrollments: [enrollment],
      enrollment_offboarding_items: offboardingItems,
    }),
    silent: true,
    latency: 0,
  }),
});

describe("endEnrollment", () => {
  it("withdraws a client who left before finishing", async () => {
    // Arrange
    const { dataProvider } = buildFixtures(buildEnrollment());

    // Act
    const result = await endEnrollment(
      dataProvider,
      ENROLLMENT_ID,
      "withdrawn",
    );

    // Assert
    expect(result).toEqual({ applied: true, status: "withdrawn" });
    const { data } = await dataProvider.getOne<Enrollment>("enrollments", {
      id: ENROLLMENT_ID,
    });
    expect(data.status).toBe("withdrawn");
  });

  it("ends an engagement neutrally, without claiming it was completed", async () => {
    // Arrange — "ended" describes the container, not the person, and must
    // stay distinct from "completed" on their own record.
    const { dataProvider } = buildFixtures(buildEnrollment());

    // Act
    await endEnrollment(dataProvider, ENROLLMENT_ID, "ended");

    // Assert
    const { data } = await dataProvider.getOne<Enrollment>("enrollments", {
      id: ENROLLMENT_ID,
    });
    expect(data.status).toBe("ended");
    expect(data.status).not.toBe("completed");
  });

  it("moves the client to Past", async () => {
    // Arrange — a terminal status is decisive regardless of dates, so
    // somebody who withdrew mid-container stops being a current client.
    const { dataProvider } = buildFixtures(buildEnrollment());

    // Act
    await endEnrollment(dataProvider, ENROLLMENT_ID, "withdrawn");
    const { data } = await dataProvider.getOne<Enrollment>("enrollments", {
      id: ENROLLMENT_ID,
    });

    // Assert
    expect(classifyEnrollment(data)).toBe("past");
  });

  it("invents no end date", async () => {
    // Arrange — the date somebody stopped is not the date the CRM was
    // told, and Past ordering reads end dates as evidence.
    const { dataProvider } = buildFixtures(buildEnrollment());

    // Act
    await endEnrollment(dataProvider, ENROLLMENT_ID, "withdrawn");

    // Assert
    const { data } = await dataProvider.getOne<Enrollment>("enrollments", {
      id: ENROLLMENT_ID,
    });
    expect(data.end_date).toBeNull();
  });

  it("does not pretend offboarding was carried out", async () => {
    // Arrange — somebody who withdrew halfway did not complete an
    // offboarding process; ticking those items would record work nobody
    // did.
    const item: EnrollmentOffboardingItem = {
      id: 1,
      enrollment_id: ENROLLMENT_ID,
      requirement_key: "revoke_access",
      label: "Revoke access",
      task_text_template: "Revoke {name}'s access",
      is_required: true,
      sort_order: 1,
      status: "pending",
      completed_at: null,
      external_ref: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    } as EnrollmentOffboardingItem;
    const { dataProvider } = buildFixtures(buildEnrollment(), [item]);

    // Act
    await endEnrollment(dataProvider, ENROLLMENT_ID, "withdrawn");

    // Assert
    const { data } = await dataProvider.getList<EnrollmentOffboardingItem>(
      "enrollment_offboarding_items",
      {
        filter: { enrollment_id: ENROLLMENT_ID },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "sort_order", order: "ASC" },
      },
    );
    expect(data.every((i) => i.status === "pending")).toBe(true);
  });

  it("is a safe no-op on a client who already finished", async () => {
    // Arrange — a double-click or a stale tab must not overwrite
    // "completed" with "withdrawn".
    const { dataProvider } = buildFixtures(
      buildEnrollment({ status: "completed" }),
    );

    // Act
    const result = await endEnrollment(
      dataProvider,
      ENROLLMENT_ID,
      "withdrawn",
    );

    // Assert
    expect(result).toEqual({
      applied: false,
      reason: "already-terminal",
      status: "completed",
    });
    const { data } = await dataProvider.getOne<Enrollment>("enrollments", {
      id: ENROLLMENT_ID,
    });
    expect(data.status).toBe("completed");
  });

  it("records the transition in status history", async () => {
    // Arrange
    const { dataProvider } = buildFixtures(buildEnrollment());

    // Act
    await endEnrollment(dataProvider, ENROLLMENT_ID, "ended");

    // Assert — when Leif was told, not a fabricated historical date.
    const { data } = await dataProvider.getList<EnrollmentStatusEvent>(
      "enrollment_status_events",
      {
        filter: { enrollment_id: ENROLLMENT_ID },
        pagination: { page: 1, perPage: 50 },
        sort: { field: "entered_at", order: "ASC" },
      },
    );
    expect(data.map((e) => e.status)).toContain("ended");
  });
});
