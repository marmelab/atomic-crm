import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import { bookClientSession } from "./bookClientSession";
import { markClientSessionNoShow } from "./markClientSessionNoShow";
import { reverseClientSessionNoShow } from "./reverseClientSessionNoShow";

const buildProvider = () =>
  createDataProvider({
    db: createCrmDb({
      contacts: [
        buildContact({ id: 1, first_name: "Ada", last_name: "Lovelace" }),
      ],
      client_sessions: [],
      client_session_events: [],
    } as any),
    silent: true,
  });

const book = (dataProvider: ReturnType<typeof createDataProvider>) =>
  bookClientSession({
    dataProvider,
    contactId: 1,
    enrollmentId: 100,
    offerId: 1,
    scheduledAt: "2020-01-01T18:00:00.000Z",
    source: "acuity",
    acuityAppointmentId: "acuity-1",
    acuityAppointmentTypeId: "90522599",
  });

describe("reverseClientSessionNoShow", () => {
  it("restores fulfillment by clearing no_show_at and recording a durable correction event", async () => {
    const dataProvider = buildProvider();
    const booked = await book(dataProvider);
    if (booked.status !== "booked") throw new Error("expected booked");
    await markClientSessionNoShow(dataProvider, booked.clientSession.id);

    const result = await reverseClientSessionNoShow(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("reversed");

    const { data: session } = await dataProvider.getOne("client_sessions", {
      id: booked.clientSession.id,
    });
    expect(session.no_show_at).toBeFalsy();

    const { data: events } = await dataProvider.getList(
      "client_session_events",
      {
        filter: { client_session_id: booked.clientSession.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((event) => event.kind)).toContain("no_show_reversed");
  });

  it("reversing a session that was never marked no-show is a safe no-op", async () => {
    const dataProvider = buildProvider();
    const booked = await book(dataProvider);
    if (booked.status !== "booked") throw new Error("expected booked");

    const result = await reverseClientSessionNoShow(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("not-no-show");
  });

  it("auto-resolves the no-show-generated cadence issue once fulfillment is restored, and completes its Task", async () => {
    const dataProvider = createDataProvider({
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
            window_start: "2020-01-01",
            window_end: "2020-01-05",
            created_at: "2020-01-01T00:00:00.000Z",
          },
        ],
        client_sessions: [],
        client_session_events: [],
      } as any),
      silent: true,
    });
    const booked = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2020-01-02T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-4",
      acuityAppointmentTypeId: "90522599",
    });
    if (booked.status !== "booked") throw new Error("expected booked");
    await markClientSessionNoShow(dataProvider, booked.clientSession.id);

    await reverseClientSessionNoShow(dataProvider, booked.clientSession.id);

    const { data: issues } = await dataProvider.getList(
      "client_session_cadence_issues",
      {
        filter: { enrollment_id: 100, enrollment_expected_session_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].resolved_at).toBeTruthy();
    // Auto-resolved via restored fulfillment — never a human classification.
    expect(issues[0].classification).toBeFalsy();

    const { data: tasks } = await dataProvider.getList("tasks", {
      filter: { cadence_issue_id: issues[0].id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks[0].status).toBe("completed");
  });
});
