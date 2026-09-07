import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb } from "@/test/StoryWrapper";
import { findEnrollmentExpectedSessionForSession } from "./findEnrollmentExpectedSessionForSession";

const buildProvider = (slots: Record<string, unknown>[]) =>
  createDataProvider({
    db: createCrmDb({
      enrollment_expected_sessions: slots,
    } as any),
    silent: true,
  });

describe("findEnrollmentExpectedSessionForSession", () => {
  it("finds the Enrollment's own assigned slot whose range contains the session's scheduled time", async () => {
    const dataProvider = buildProvider([
      {
        id: 1,
        enrollment_id: 100,
        ordinal: 1,
        window_start: "2026-09-13",
        window_end: "2026-09-17",
        raw_title: "1:1s",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const slot = await findEnrollmentExpectedSessionForSession(dataProvider, {
      enrollmentId: 100,
      scheduledAt: "2026-09-15T18:00:00.000Z",
    });
    expect(slot?.id).toBe(1);
  });

  it("returns null when no assigned slot covers the scheduled time", async () => {
    const dataProvider = buildProvider([
      {
        id: 1,
        enrollment_id: 100,
        ordinal: 1,
        window_start: "2026-09-13",
        window_end: "2026-09-17",
        raw_title: "1:1s",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const slot = await findEnrollmentExpectedSessionForSession(dataProvider, {
      enrollmentId: 100,
      scheduledAt: "2026-10-01T18:00:00.000Z",
    });
    expect(slot).toBeNull();
  });

  it("never matches a slot belonging to a different Enrollment", async () => {
    const dataProvider = buildProvider([
      {
        id: 1,
        enrollment_id: 200,
        ordinal: 1,
        window_start: "2026-09-13",
        window_end: "2026-09-17",
        raw_title: "1:1s",
        created_at: "2026-01-01T00:00:00.000Z",
      },
    ]);

    const slot = await findEnrollmentExpectedSessionForSession(dataProvider, {
      enrollmentId: 100,
      scheduledAt: "2026-09-15T18:00:00.000Z",
    });
    expect(slot).toBeNull();
  });
});
