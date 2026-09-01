import { commands } from "vitest/browser";

import { formatTimestampString } from "../deals/dealUtils";
import { computePostponeDueDate } from "./postponeTaskDate";

// Small polish/cleanup slice: postpone-tomorrow/postpone-next-week
// previously stored `new Date(Date.now() + 24h).toISOString().slice(0, 10)`
// — a bare UTC calendar date, the same class of bug already fixed in
// followUpTask.ts for deals.follow_up_date. Two regressions guarded here:
// (1) "tomorrow" must be computed relative to the CRM's established
// America/Denver business day, not a raw UTC millisecond shift; (2) the
// resulting timestamp must display the intended calendar date for any
// real viewer timezone, never a day early.
describe("computePostponeDueDate", () => {
  let originalTimezone: string;

  beforeEach(() => {
    originalTimezone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  });

  afterEach(async () => {
    await commands.setTimezone(originalTimezone);
  });

  it("postpone tomorrow: advances exactly one Denver calendar day", () => {
    // Mid-afternoon in Denver — nowhere near a day boundary in any zone.
    const now = new Date("2026-06-15T18:00:00.000Z"); // 12:00 MDT (UTC-6)
    const dueDate = computePostponeDueDate(now, 1);
    expect(formatTimestampString(dueDate)).toBe("Jun 16, 2026");
  });

  it("postpone next week: advances exactly seven Denver calendar days", () => {
    const now = new Date("2026-06-15T18:00:00.000Z");
    const dueDate = computePostponeDueDate(now, 7);
    expect(formatTimestampString(dueDate)).toBe("Jun 22, 2026");
  });

  it("America/Denver boundary: late evening in Denver, already the next UTC day", async () => {
    // 2026-06-15 23:00 MDT (UTC-6) = 2026-06-16 05:00 UTC. The old buggy
    // implementation (Date.now() + 24h, then slice the UTC date) would
    // compute "tomorrow" as UTC's 06-17 here — one day past the real
    // Denver tomorrow (06-16) — because it never anchored to Denver at
    // all. Viewer emulated as Denver too, so a display-side bug can't
    // mask a computation-side one.
    await commands.setTimezone("America/Denver");
    const now = new Date("2026-06-16T05:00:00.000Z");
    const dueDate = computePostponeDueDate(now, 1);
    expect(formatTimestampString(dueDate)).toBe("Jun 16, 2026");
  });

  it("America/Denver boundary: just past midnight UTC, still the prior Denver day", async () => {
    // 2026-06-16 00:30 UTC = 2026-06-15 18:30 MDT — still June 15 in
    // Denver. "Tomorrow" must be June 16, not June 17.
    await commands.setTimezone("America/Denver");
    const now = new Date("2026-06-16T00:30:00.000Z");
    const dueDate = computePostponeDueDate(now, 1);
    expect(formatTimestampString(dueDate)).toBe("Jun 16, 2026");
  });

  it("resulting Dashboard display date never shifts a day early, for any viewer timezone", async () => {
    const now = new Date("2026-06-15T18:00:00.000Z");
    const dueDate = computePostponeDueDate(now, 1);

    for (const timezoneId of [
      "America/Denver",
      "America/New_York",
      "UTC",
      "Asia/Tokyo",
      "Pacific/Auckland",
    ]) {
      await commands.setTimezone(timezoneId);
      expect(formatTimestampString(dueDate)).toBe("Jun 16, 2026");
    }
  });

  it("rolls over a month/year boundary correctly", () => {
    const now = new Date("2026-12-30T18:00:00.000Z"); // 11:00 MST (Denver, UTC-7 in December)
    const dueDate = computePostponeDueDate(now, 7);
    expect(formatTimestampString(dueDate)).toBe("Jan 6, 2027");
  });
});
