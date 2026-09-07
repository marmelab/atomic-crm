// @vitest-environment node
import { describe, expect, it } from "vitest";
import { parseIcsEvents } from "./parseIcsEvents";

// Fixture VEVENT blocks below mirror the REAL shape confirmed by
// inspecting Leif's actual "Year Planning" Google Calendar (read-only,
// via the connected Calendar tool) before writing this parser — real
// observed title variance ("1:1s", "1:1 week"), real all-day
// DTSTART;VALUE=DATE / DTEND;VALUE=DATE encoding, and a real timed
// (non-all-day) sibling event ("Th Group") on the same calendar that
// must never be mistaken for a 1:1 window.
const ICS_HEADER = "BEGIN:VCALENDAR\r\nVERSION:2.0\r\n";
const ICS_FOOTER = "END:VCALENDAR\r\n";

const allDayEvent = ({
  uid,
  summary,
  start,
  end,
}: {
  uid: string;
  summary: string;
  start: string;
  end: string;
}) =>
  [
    "BEGIN:VEVENT",
    `UID:${uid}`,
    `SUMMARY:${summary}`,
    `DTSTART;VALUE=DATE:${start}`,
    `DTEND;VALUE=DATE:${end}`,
    "STATUS:CONFIRMED",
    "END:VEVENT",
  ].join("\r\n") + "\r\n";

describe("parseIcsEvents", () => {
  it("parses a real all-day 1:1s VEVENT into an ISO date-only window", () => {
    const ics =
      ICS_HEADER +
      allDayEvent({
        uid: "1kdidnf5jleu8cjo5bkrkm6psh",
        summary: "1:1s",
        start: "20260913",
        end: "20260917",
      }) +
      ICS_FOOTER;

    const events = parseIcsEvents(ics);
    expect(events).toHaveLength(1);
    expect(events[0]).toMatchObject({
      uid: "1kdidnf5jleu8cjo5bkrkm6psh",
      summary: "1:1s",
      startDate: "2026-09-13",
      endDate: "2026-09-17",
      hasRecurrenceRule: false,
    });
  });

  it("parses the real title variant '1:1 week' the same way as '1:1s'", () => {
    const ics =
      ICS_HEADER +
      allDayEvent({
        uid: "7mlhk1j2pt1uo7mefe32uquar0",
        summary: "1:1 week",
        start: "20261108",
        end: "20261112",
      }) +
      ICS_FOOTER;

    const events = parseIcsEvents(ics);
    expect(events[0].summary).toBe("1:1 week");
    expect(events[0].startDate).toBe("2026-11-08");
  });

  it("a timed (non-all-day) sibling event on the same calendar parses with a null startDate/endDate — never misread as a window", () => {
    const ics =
      ICS_HEADER +
      [
        "BEGIN:VEVENT",
        "UID:50qr9v09h12luiuemosn279kpv",
        "SUMMARY:Th Group",
        "DTSTART;TZID=America/Denver:20260106T180000",
        "DTEND;TZID=America/Denver:20260106T200000",
        "STATUS:CONFIRMED",
        "END:VEVENT",
      ].join("\r\n") +
      "\r\n" +
      ICS_FOOTER;

    const events = parseIcsEvents(ics);
    expect(events[0].summary).toBe("Th Group");
    expect(events[0].startDate).toBeNull();
    expect(events[0].endDate).toBeNull();
  });

  it("unfolds a line continuation (a space-prefixed line) before parsing", () => {
    const ics =
      ICS_HEADER +
      [
        "BEGIN:VEVENT",
        "UID:folded-1",
        "SUMMARY:1:1s add",
        " itional text folded onto the previous line",
        "DTSTART;VALUE=DATE:20260621",
        "DTEND;VALUE=DATE:20260625",
        "END:VEVENT",
      ].join("\r\n") +
      "\r\n" +
      ICS_FOOTER;

    const events = parseIcsEvents(ics);
    expect(events[0].summary).toBe(
      "1:1s additional text folded onto the previous line",
    );
  });

  it("flags a VEVENT carrying an RRULE rather than expanding it", () => {
    const ics =
      ICS_HEADER +
      [
        "BEGIN:VEVENT",
        "UID:recurring-1",
        "SUMMARY:1:1s",
        "DTSTART;VALUE=DATE:20260101",
        "DTEND;VALUE=DATE:20260105",
        "RRULE:FREQ=WEEKLY",
        "END:VEVENT",
      ].join("\r\n") +
      "\r\n" +
      ICS_FOOTER;

    const events = parseIcsEvents(ics);
    expect(events[0].hasRecurrenceRule).toBe(true);
  });

  it("ignores a VEVENT with no UID rather than crashing", () => {
    const ics =
      ICS_HEADER +
      [
        "BEGIN:VEVENT",
        "SUMMARY:1:1s",
        "DTSTART;VALUE=DATE:20260101",
        "DTEND;VALUE=DATE:20260105",
        "END:VEVENT",
      ].join("\r\n") +
      "\r\n" +
      ICS_FOOTER;

    expect(parseIcsEvents(ics)).toHaveLength(0);
  });
});
