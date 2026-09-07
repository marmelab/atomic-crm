import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import {
  reopenCadenceIssue,
  setCadenceIssueClassification,
} from "./resolveClientSessionCadenceIssue";

const buildProvider = (issueOverrides: Record<string, unknown> = {}) =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      client_session_cadence_issues: [
        {
          id: 1,
          enrollment_id: 1,
          enrollment_expected_session_id: 1,
          classification: null,
          note: null,
          resolved_at: null,
          created_at: "2026-01-01T00:00:00.000Z",
          updated_at: "2026-01-01T00:00:00.000Z",
          ...issueOverrides,
        },
      ],
      client_session_cadence_issue_events: [],
      tasks: [
        {
          id: 1,
          contact_id: 1,
          type: "resolve_client_session_cadence",
          text: "Ada Lovelace · No session booked for week of Mar 15–18",
          due_date: "2026-03-20T00:00:00.000Z",
          status: "pending",
          cadence_issue_id: 1,
        },
      ],
    } as any),
    silent: true,
  });

describe("setCadenceIssueClassification", () => {
  it("resolves an open issue, completes its linked Task, and logs a 'resolved' event", async () => {
    const dataProvider = buildProvider();
    const result = await setCadenceIssueClassification(dataProvider, {
      cadenceIssueId: 1,
      classification: "known_skip",
      note: "Client traveling",
    });
    expect(result.status).toBe("resolved");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.classification).toBe("known_skip");
    expect(issue.resolved_at).toBeTruthy();

    const { data: task } = await dataProvider.getOne("tasks", { id: 1 });
    expect(task.status).toBe("completed");

    const { data: events } = await dataProvider.getList(
      "client_session_cadence_issue_events",
      {
        filter: { cadence_issue_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((event) => event.kind)).toEqual(["resolved"]);
  });

  it("Known skip can be changed to Rescheduled — a reclassification, not a second resolution", async () => {
    const dataProvider = buildProvider({
      classification: "known_skip",
      resolved_at: "2026-03-20T00:00:00.000Z",
    });

    const result = await setCadenceIssueClassification(dataProvider, {
      cadenceIssueId: 1,
      classification: "rescheduled",
    });
    expect(result.status).toBe("reclassified");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.classification).toBe("rescheduled");

    const { data: events } = await dataProvider.getList(
      "client_session_cadence_issue_events",
      {
        filter: { cadence_issue_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((event) => event.kind)).toEqual(["reclassified"]);
  });

  it("Rescheduled can be changed to Missed/ghosted", async () => {
    const dataProvider = buildProvider({
      classification: "rescheduled",
      resolved_at: "2026-03-20T00:00:00.000Z",
    });

    const result = await setCadenceIssueClassification(dataProvider, {
      cadenceIssueId: 1,
      classification: "missed_ghosted",
    });
    expect(result.status).toBe("reclassified");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.classification).toBe("missed_ghosted");
  });

  it("re-submitting the same classification already current is a safe no-op — no duplicate event", async () => {
    const dataProvider = buildProvider({
      classification: "known_skip",
      resolved_at: "2026-03-20T00:00:00.000Z",
    });

    const result = await setCadenceIssueClassification(dataProvider, {
      cadenceIssueId: 1,
      classification: "known_skip",
    });
    expect(result.status).toBe("unchanged");

    const { data: events } = await dataProvider.getList(
      "client_session_cadence_issue_events",
      {
        filter: { cadence_issue_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events).toHaveLength(0);
  });
});

describe("reopenCadenceIssue", () => {
  it("clears a classification made by mistake, reopens the linked Task, and logs a 'reopened' event", async () => {
    const dataProvider = buildProvider({
      classification: "known_skip",
      resolved_at: "2026-03-20T00:00:00.000Z",
    });
    await dataProvider.update("tasks", {
      id: 1,
      data: { done_date: "2026-03-20T00:00:00.000Z", status: "completed" },
      previousData: (await dataProvider.getOne("tasks", { id: 1 })).data,
    });

    const result = await reopenCadenceIssue(dataProvider, {
      cadenceIssueId: 1,
    });
    expect(result.status).toBe("reopened");

    const { data: issue } = await dataProvider.getOne(
      "client_session_cadence_issues",
      { id: 1 },
    );
    expect(issue.classification).toBeFalsy();
    expect(issue.resolved_at).toBeFalsy();

    const { data: task } = await dataProvider.getOne("tasks", { id: 1 });
    expect(task.done_date).toBeFalsy();
    expect(task.status).toBe("pending");

    const { data: events } = await dataProvider.getList(
      "client_session_cadence_issue_events",
      {
        filter: { cadence_issue_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((event) => event.kind)).toEqual(["reopened"]);
  });

  it("reopening an already-open issue is a safe no-op", async () => {
    const dataProvider = buildProvider();
    const result = await reopenCadenceIssue(dataProvider, {
      cadenceIssueId: 1,
    });
    expect(result.status).toBe("already-open");
  });
});
