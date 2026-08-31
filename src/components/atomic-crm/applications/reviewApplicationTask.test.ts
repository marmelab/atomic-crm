import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest/dataProvider";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { Application, Task } from "../types";
import {
  ensureReviewApplicationTask,
  findPendingReviewApplicationTask,
} from "./reviewApplicationTask";

const CONTACT_ID = 1;

const buildDataProvider = (tasks: Task[] = []) =>
  createDataProvider({
    db: createCrmDb({ contacts: [buildContact({ id: CONTACT_ID })], tasks }),
    silent: true,
    latency: 0,
  });

describe("ensureReviewApplicationTask", () => {
  it("creates a pending Review Application task when none exists", async () => {
    const dataProvider = buildDataProvider([]);

    await ensureReviewApplicationTask(dataProvider, {
      contactId: CONTACT_ID,
      applicantName: "Rosalind Park",
    });

    const task = await findPendingReviewApplicationTask(
      dataProvider,
      CONTACT_ID,
    );
    expect(task).not.toBeNull();
    expect(task?.type).toBe("review_application");
    expect(task?.text).toContain("Rosalind Park");
  });

  it("does not create a duplicate task when a pending one already exists", async () => {
    const dataProvider = buildDataProvider([]);

    await ensureReviewApplicationTask(dataProvider, {
      contactId: CONTACT_ID,
      applicantName: "Rosalind Park",
    });
    await ensureReviewApplicationTask(dataProvider, {
      contactId: CONTACT_ID,
      applicantName: "Rosalind Park",
    });

    const { total } = await dataProvider.getList<Task>("tasks", {
      filter: { contact_id: CONTACT_ID, type: "review_application" },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(total).toBe(1);
  });
});

describe("manual task completion vs. Application status", () => {
  it("completing a Review Application task by hand never changes Application status", async () => {
    const application: Application = {
      id: 1,
      opportunity_id: 1,
      status: "pending",
      submitted_at: "2026-01-01T00:00:00.000Z",
      reviewed_at: null,
      raw_answers: {},
      summary: null,
      created_at: "2026-01-01T00:00:00.000Z",
      updated_at: "2026-01-01T00:00:00.000Z",
    };
    const task: Task = {
      id: 1,
      contact_id: CONTACT_ID,
      type: "review_application",
      text: "Review Rosalind Park's application",
      due_date: "2026-01-01T00:00:00.000Z",
      done_date: null,
      status: "pending",
      sales_id: 0,
    };
    const dataProvider = createDataProvider({
      db: createCrmDb({
        contacts: [buildContact({ id: CONTACT_ID })],
        applications: [application],
        tasks: [task],
      }),
      silent: true,
      latency: 0,
    });

    // Task's own checkbox toggle only ever sends done_date (see Task.tsx) —
    // Application/Deal/Contact are never touched by that write (§8: a Task
    // only represents work to do; it never controls Application status).
    await dataProvider.update("tasks", {
      id: task.id,
      data: { done_date: new Date().toISOString() },
      previousData: task,
    });

    const { data: updatedApplication } = await dataProvider.getOne<Application>(
      "applications",
      { id: application.id },
    );
    expect(updatedApplication.status).toBe("pending");
  });
});
