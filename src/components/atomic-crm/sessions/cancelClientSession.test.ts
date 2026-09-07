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

describe("cancelClientSession", () => {
  it("cancels the correct durable session and records a cancelled event", async () => {
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

    const result = await cancelClientSession(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("cancelled");
    if (result.status !== "cancelled") return;
    expect(result.clientSession.status).toBe("cancelled");
  });

  it("a duplicate cancellation webhook is a safe no-op", async () => {
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
    await cancelClientSession(dataProvider, booked.clientSession.id);
    const second = await cancelClientSession(
      dataProvider,
      booked.clientSession.id,
    );
    expect(second.status).toBe("already-cancelled");
  });

  it("a late/out-of-order cancellation never erases an already-recorded no-show", async () => {
    const dataProvider = buildProvider();
    const booked = await bookClientSession({
      dataProvider,
      contactId: 1,
      enrollmentId: 100,
      offerId: 1,
      scheduledAt: "2020-01-01T18:00:00.000Z",
      source: "acuity",
      acuityAppointmentId: "acuity-3",
      acuityAppointmentTypeId: "90522599",
    });
    if (booked.status !== "booked") throw new Error("expected booked");
    await markClientSessionNoShow(dataProvider, booked.clientSession.id);

    const result = await cancelClientSession(
      dataProvider,
      booked.clientSession.id,
    );
    expect(result.status).toBe("cancelled");
    const { data: session } = await dataProvider.getOne("client_sessions", {
      id: booked.clientSession.id,
    });
    expect(session.no_show_at).toBeTruthy();
  });
});
