import { advanceOutreachStatus, eventTypeToStatus } from "./outreachStatus";

describe("advanceOutreachStatus", () => {
  it("advances forward along the funnel", () => {
    expect(advanceOutreachStatus("emailed", "replied")).toBe("replied");
    expect(advanceOutreachStatus("not_contacted", "queued")).toBe("queued");
  });

  it("does not regress to an earlier funnel stage", () => {
    expect(advanceOutreachStatus("replied", "emailed")).toBe("replied");
    expect(advanceOutreachStatus("opened", "opened")).toBe("opened");
  });

  it("treats null/undefined current as not_contacted", () => {
    expect(advanceOutreachStatus(null, "emailed")).toBe("emailed");
    expect(advanceOutreachStatus(undefined, "queued")).toBe("queued");
  });

  it("lets a terminal-negative state win and stick", () => {
    expect(advanceOutreachStatus("replied", "bounced")).toBe("bounced");
    expect(advanceOutreachStatus("bounced", "opened")).toBe("bounced");
    expect(advanceOutreachStatus("unsubscribed", "interested")).toBe(
      "unsubscribed",
    );
  });

  it("replaces an existing terminal-negative with a newer one", () => {
    expect(advanceOutreachStatus("bounced", "unsubscribed")).toBe(
      "unsubscribed",
    );
  });
});

describe("eventTypeToStatus", () => {
  it("maps events to the implied status", () => {
    expect(eventTypeToStatus("emailed")).toBe("emailed");
    expect(eventTypeToStatus("clicked")).toBe("opened");
    expect(eventTypeToStatus("meeting_booked")).toBe("meeting_booked");
    expect(eventTypeToStatus("bounced")).toBe("bounced");
  });

  it("returns null for events that do not change status", () => {
    expect(eventTypeToStatus("neutral")).toBeNull();
  });
});
