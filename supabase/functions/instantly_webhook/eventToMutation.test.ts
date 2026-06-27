import { describe, it, expect } from "vitest";
import {
  advanceOutreachStatus,
  eventTypeToStatus,
  mapInstantlyEvent,
} from "./eventToMutation";

describe("mapInstantlyEvent", () => {
  it("maps a reply to a note-creating event", () => {
    const m = mapInstantlyEvent("reply_received");
    expect(m).toEqual({
      type: "replied",
      addNote: true,
      markEmailInvalid: false,
      addTag: null,
    });
  });

  it("maps a bounce to an email-invalidating event", () => {
    const m = mapInstantlyEvent("email_bounced");
    expect(m?.type).toBe("bounced");
    expect(m?.markEmailInvalid).toBe(true);
  });

  it("maps unsubscribe and wrong-person to tag-adding events", () => {
    expect(mapInstantlyEvent("lead_unsubscribed")?.addTag).toBe("Unsubscribed");
    expect(mapInstantlyEvent("lead_wrong_person")?.addTag).toBe("Wrong person");
  });

  it("is case-insensitive", () => {
    expect(mapInstantlyEvent("LEAD_INTERESTED")?.type).toBe("interested");
  });

  it("returns null for unhandled or missing events", () => {
    expect(mapInstantlyEvent("campaign_completed")).toBeNull();
    expect(mapInstantlyEvent("email_account_error")).toBeNull();
    expect(mapInstantlyEvent(undefined)).toBeNull();
    expect(mapInstantlyEvent("")).toBeNull();
  });
});

describe("eventTypeToStatus", () => {
  it("maps clicks up to opened and meetings through", () => {
    expect(eventTypeToStatus("clicked")).toBe("opened");
    expect(eventTypeToStatus("meeting_booked")).toBe("meeting_booked");
    expect(eventTypeToStatus("neutral")).toBeNull();
  });
});

describe("advanceOutreachStatus", () => {
  it("advances forward and never regresses", () => {
    expect(advanceOutreachStatus("emailed", "replied")).toBe("replied");
    expect(advanceOutreachStatus("replied", "opened")).toBe("replied");
  });

  it("lets a bounce/unsubscribe win and stick", () => {
    expect(advanceOutreachStatus("replied", "bounced")).toBe("bounced");
    expect(advanceOutreachStatus("bounced", "interested")).toBe("bounced");
  });
});
