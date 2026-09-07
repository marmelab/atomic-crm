import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { ClientSession, ClientSessionEvent } from "../types";
import { bookClientSession } from "./bookClientSession";

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

describe("bookClientSession", () => {
  it("books a new session for a matched Enrollment and records a booked event", async () => {
    const dataProvider = buildProvider();
    const result = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: "90522599",
    });
    expect(result.status).toBe("booked");
    if (result.status !== "booked") return;
    expect(result.clientSession.enrollment_id).toBe(100);
    expect(result.clientSession.status).toBe("booked");

    const { data: events } = await dataProvider.getList<ClientSessionEvent>(
      "client_session_events",
      {
        filter: { client_session_id: result.clientSession.id },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(events).toHaveLength(1);
    expect(events[0].kind).toBe("booked");
  });

  it("preserves an unresolved session (enrollment_id null) rather than manufacturing a match", async () => {
    const dataProvider = buildProvider();
    const result = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: null,
      offerId: 1,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-2",
      acuityAppointmentTypeId: "90522599",
    });
    expect(result.status).toBe("booked");
    if (result.status !== "booked") return;
    expect(result.clientSession.enrollment_id).toBeFalsy();
  });

  it("a duplicate webhook delivery for the same Acuity appointment id is a safe no-op, never a second row", async () => {
    const dataProvider = buildProvider();
    await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-3",
      acuityAppointmentTypeId: "90522599",
    });
    const second = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-3",
      acuityAppointmentTypeId: "90522599",
    });
    expect(second.status).toBe("already-booked");

    const { total } = await dataProvider.getList<ClientSession>(
      "client_sessions",
      {
        filter: { acuity_appointment_id: "acuity-3" },
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(total).toBe(1);
  });
});
