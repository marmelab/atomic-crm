import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import { resolveCadenceIssueFulfillment } from "./resolveCadenceIssueFulfillment";

const buildProvider = (overrides: Record<string, unknown[]> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      enrollment_expected_sessions: [
        {
          id: 1,
          enrollment_id: 100,
          source_window_id: 1,
          ordinal: 1,
          raw_title: "1:1s",
          window_start: "2026-09-13",
          window_end: "2026-09-17",
          created_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      client_sessions: [],
      tasks: [],
      ...overrides,
    } as any),
    silent: true,
  });

describe("resolveCadenceIssueFulfillment", () => {
  it("auto-resolves an issue once a non-cancelled, non-no-show session fulfills its assigned slot", async () => {
    const dataProvider = buildProvider({
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 100,
          enrollment_expected_session_id: 1,
          classification: null,
          resolved_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      client_sessions: [
        {
          id: 1,
          contact_id: 1,
          enrollment_id: 100,
          offer_id: 1,
          status: "booked",
          scheduled_at: "2026-09-15T18:00:00.000Z",
          reschedule_count: 0,
          source: "acuity",
        },
      ],
      tasks: [
        {
          id: 1,
          contact_id: 1,
          type: "resolve_client_session_cadence",
          text: "Ada Lovelace · No session booked for week of Sep 13–16",
          due_date: "2026-09-18T00:00:00.000Z",
          status: "pending",
          cadence_issue_id: 1,
        },
      ],
    });

    const result = await resolveCadenceIssueFulfillment(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("resolved");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.resolved_at).toBeTruthy();
    expect(issue.classification).toBeFalsy();

    const { data: task } = await dataProvider.getOne("tasks", { id: 1 });
    expect(task.status).toBe("completed");
    expect(task.done_date).toBeTruthy();
  });

  it("leaves the issue open when the slot still has no fulfilling session", async () => {
    const dataProvider = buildProvider({
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 100,
          enrollment_expected_session_id: 1,
          classification: null,
          resolved_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
    });

    const result = await resolveCadenceIssueFulfillment(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("not-fulfilled");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.resolved_at).toBeFalsy();
  });

  it("never touches an issue already resolved with a real human classification, even once fulfillment returns", async () => {
    const dataProvider = buildProvider({
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 100,
          enrollment_expected_session_id: 1,
          classification: "known_skip",
          resolved_at: "2026-09-18T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      client_sessions: [
        {
          id: 1,
          contact_id: 1,
          enrollment_id: 100,
          offer_id: 1,
          status: "booked",
          scheduled_at: "2026-09-15T18:00:00.000Z",
          reschedule_count: 0,
          source: "acuity",
        },
      ],
    });

    const result = await resolveCadenceIssueFulfillment(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("left-classified");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.classification).toBe("known_skip");
  });

  it("is a safe no-op when there is no issue at all for this slot", async () => {
    const dataProvider = buildProvider();
    const result = await resolveCadenceIssueFulfillment(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("no-issue");
  });
});
