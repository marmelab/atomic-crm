import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import { bookClientSession } from "./bookClientSession";
import { cancelClientSession } from "./cancelClientSession";
import { markClientSessionNoShow } from "./markClientSessionNoShow";

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

describe("markClientSessionNoShow", () => {
  it("marks a booked session as no-show and records a durable event", async () => {
    const dataProvider = buildProvider();
    const booked = await book(dataProvider);
    if (booked.status !== "booked") throw new Error("expected booked");

    const result = await markClientSessionNoShow(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("no-show");

    const { data: session } = await dataProvider.getOne("client_sessions", {
      id: booked.clientSession.id,
    });
    expect(session.no_show_at).toBeTruthy();
    // The session's own status is untouched — no-show is a separate,
    // independent flag, never a synonym for cancelled.
    expect(session.status).toBe("booked");

    const { data: events } = await dataProvider.getList(
      "client_session_events",
      {
        filter: { client_session_id: booked.clientSession.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events.map((event) => event.kind)).toContain("no_show");
  });

  it("a duplicate no-show click is a safe no-op", async () => {
    const dataProvider = buildProvider();
    const booked = await book(dataProvider);
    if (booked.status !== "booked") throw new Error("expected booked");
    await markClientSessionNoShow(dataProvider, booked.clientSession.id);

    const second = await markClientSessionNoShow(
      dataProvider,
      booked.clientSession.id,
    );
    expect(second.status).toBe("already-no-show");
  });

  it("refuses to mark a cancelled session as no-show", async () => {
    const dataProvider = buildProvider();
    const booked = await book(dataProvider);
    if (booked.status !== "booked") throw new Error("expected booked");
    await cancelClientSession(dataProvider, booked.clientSession.id);

    const result = await markClientSessionNoShow(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("cancelled-session");
  });

  it("refuses to mark a not-yet-occurred future session as no-show", async () => {
    const dataProvider = buildProvider();
    const future = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();
    const booked = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: future,
      source: "acuity",
      acuityAppointmentId: "acuity-2",
      acuityAppointmentTypeId: "90522599",
    });
    if (booked.status !== "booked") throw new Error("expected booked");

    const result = await markClientSessionNoShow(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("not-yet-occurred");
  });

  it("creates a cadence issue and its Needs Attention Task the moment a fulfilling session is marked No-show — no waiting for the next calendar sync", async () => {
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
      acuityAppointmentId: "acuity-3",
      acuityAppointmentTypeId: "90522599",
    });
    if (booked.status !== "booked") throw new Error("expected booked");

    await markClientSessionNoShow(dataProvider, booked.clientSession.id);

    const { data: issues } = await dataProvider.getList(
      "client_session_cadence_issues",
      {
        filter: { enrollment_id: 100, enrollment_expected_session_id: 1 },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(issues).toHaveLength(1);
    expect(issues[0].resolved_at).toBeFalsy();

    const { data: tasks } = await dataProvider.getList("tasks", {
      filter: { cadence_issue_id: issues[0].id },
      pagination: { page: 1, perPage: 10 },
      sort: { field: "id", order: "ASC" },
    });
    expect(tasks).toHaveLength(1);
    expect(tasks[0].status).toBe("pending");
  });
});
