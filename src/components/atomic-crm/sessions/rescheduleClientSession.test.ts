import { describe, expect, it } from "vitest";

import { createDataProvider } from "../providers/fakerest";
import { createCrmDb, buildContact } from "@/test/StoryWrapper";
import type { ClientSession } from "../types";
import { bookClientSession } from "./bookClientSession";
import { rescheduleClientSession } from "./rescheduleClientSession";

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

describe("rescheduleClientSession", () => {
  it("updates the SAME durable session row, never creating a second one", async () => {
    const dataProvider = buildProvider();
    const booked = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-1",
      acuityAppointmentTypeId: "90522599",
    });
    if (booked.status !== "booked") throw new Error("expected booked");

    const result = await rescheduleClientSession(dataProvider, {
      clientSessionId: booked.clientSession.id,
      newScheduledAt: "2026-09-17T18:00:00.000Z",
    });
    expect(result.status).toBe("rescheduled");
    if (result.status !== "rescheduled") return;
    expect(result.clientSession.id).toBe(booked.clientSession.id);
    expect(result.clientSession.scheduled_at).toBe("2026-09-17T18:00:00.000Z");
    expect(result.clientSession.reschedule_count).toBe(1);

    const { total } = await dataProvider.getList<ClientSession>(
      "client_sessions",
      {
        filter: {},
        pagination: { page: 1, perPage: 10 },
        sort: { field: "id", order: "ASC" },
      },
    );
    expect(total).toBe(1);
  });

  it("a duplicate reschedule webhook (same new time already recorded) is a safe no-op", async () => {
    const dataProvider = buildProvider();
    const booked = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2026-09-10T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-2",
      acuityAppointmentTypeId: "90522599",
    });
    if (booked.status !== "booked") throw new Error("expected booked");
    await rescheduleClientSession(dataProvider, {
      clientSessionId: booked.clientSession.id,
      newScheduledAt: "2026-09-17T18:00:00.000Z",
    });
    const second = await rescheduleClientSession(dataProvider, {
      clientSessionId: booked.clientSession.id,
      newScheduledAt: "2026-09-17T18:00:00.000Z",
    });
    expect(second.status).toBe("already-current");
  });
});
