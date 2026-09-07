import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import { ensureCadenceIssueOpen } from "./ensureCadenceIssueOpen";

const buildProvider = (overrides: Record<string, unknown[]> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      deals: [{ id: 10, offer_id: 1, contact_id: 1 }],
      enrollments: [{ id: 100, opportunity_id: 10, status: "active" }],
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
      client_session_cadence_issues: [],
      tasks: [],
      ...overrides,
    } as any),
    silent: true,
  });

describe("ensureCadenceIssueOpen", () => {
  it("creates a new issue and its Needs Attention Task when none exists", async () => {
    const dataProvider = buildProvider();
    const result = await ensureCadenceIssueOpen(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("created");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: result.issueId },
    );
    expect(issue.resolved_at).toBeFalsy();

    const { data: tasks } = await dataProvider.getList("tasks", {
      filter: { cadence_issue_id: result.issueId },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].text).toContain("Ada Lovelace");
  });

  it("a repeated call is idempotent — never creates a duplicate issue or Task", async () => {
    const dataProvider = buildProvider();
    const first = await ensureCadenceIssueOpen(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    const second = await ensureCadenceIssueOpen(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(second.status).toBe("already-open");
    expect(second.issueId).toBe(first.issueId);

    const { data: issues } = await dataProvider.getList(
      "client_session_cadence_issues",
      {
        filter: { enrollment_id: 100, enrollment_expected_session_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(issues).toHaveLength(1);
  });

  it("reopens an issue that was auto-resolved (classification null), reopening its Task too", async () => {
    const dataProvider = buildProvider({
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 100,
          enrollment_expected_session_id: 1,
          classification: null,
          resolved_at: "2026-09-18T00:00:00.000Z",
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
        },
      ],
      tasks: [
        {
          id: 1,
          contact_id: 1,
          type: "resolve_client_session_cadence",
          text: "Ada Lovelace · No session booked for week of Sep 13–16",
          due_date: "2026-09-18T00:00:00.000Z",
          status: "completed",
          done_date: "2026-09-18T00:00:00.000Z",
          cadence_issue_id: 1,
        },
      ],
    });

    const result = await ensureCadenceIssueOpen(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("reopened");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.resolved_at).toBeFalsy();

    const { data: task } = await dataProvider.getOne("tasks", { id: 1 });
    expect(task.done_date).toBeFalsy();
    expect(task.status).toBe("pending");
  });

  it("never touches an issue already resolved with a real human classification", async () => {
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
    });

    const result = await ensureCadenceIssueOpen(dataProvider, {
      enrollmentId: 100,
      enrollmentExpectedSessionId: 1,
    });
    expect(result.status).toBe("left-classified");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.classification).toBe("known_skip");
    expect(issue.resolved_at).toBeTruthy();
  });
});
