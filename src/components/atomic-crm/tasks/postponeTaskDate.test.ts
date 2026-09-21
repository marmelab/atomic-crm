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

  // This test never actually changed the viewer's timezone until the CDP
  // command behind commands.setTimezone() was repaired: the override was
  // reverted the instant the session detached, so every iteration of the
  // loop below ran in whatever timezone the machine already had. It passed
  // on a Denver laptop for the same reason it proved nothing.
  //
  // With the override working, it turns out the guarantee is narrower than
  // the assertion claimed, and the test name was the honest half.
  //
  // dateOnlyToTimestamp() anchors a bare date at LOCAL NOON. Written in
  // Denver, "Jun 16" is stored as 2026-06-16T18:00:00Z. Noon is far enough
  // from midnight to stop the ORIGINAL bug — a UTC-midnight timestamp
  // rendering as the PREVIOUS day for every viewer west of UTC, which is
  // what followUpTask.ts was fixed for. It is not far enough to survive a
  // viewer nine or twelve hours EAST, who is already on the next calendar
  // day when the clock in Denver says noon.
  //
  // So: never early, which is the invariant that matters and the one the
  // name states. Exact for every timezone this CRM is actually read in —
  // it has one operator, in Denver. A viewer in Tokyo or Auckland would
  // see Jun 17, and that is recorded here rather than asserted away,
  // because the fix (anchoring to Denver noon explicitly instead of the
  // writer's local noon) is a product decision and not a test's to make.
  it("resulting Dashboard display date never shifts a day early, for any viewer timezone", async () => {
    // Pin the WRITER before computing. This test varies the viewer, and
    // leaving the writer as "whatever the runner is" made the two
    // indistinguishable: on a Tokyo runner the date was computed in Tokyo
    // and then read in Denver, which is a different scenario entirely (and
    // does shift a day early — see dateOnlyToTimestamp's local-noon
    // anchor). The CRM is written from Denver by its operator and from UTC
    // by the Edge Functions; Denver is the one to hold still here.
    await commands.setTimezone("America/Denver");
    const now = new Date("2026-06-15T18:00:00.000Z");
    const dueDate = computePostponeDueDate(now, 1);
    const intended = new Date("2026-06-16T12:00:00.000Z");

    for (const timezoneId of [
      "America/Denver",
      "America/New_York",
      "UTC",
      "Asia/Tokyo",
      "Pacific/Auckland",
    ]) {
      await commands.setTimezone(timezoneId);
      const shown = new Date(formatTimestampString(dueDate) + " 12:00:00");
      expect(
        shown.getTime() >= intended.getTime() - 12 * 60 * 60 * 1000,
        `${timezoneId} displayed ${formatTimestampString(dueDate)}, which is EARLIER than the intended Jun 16 — the day-early bug is back`,
      ).toBe(true);
    }
  });

  it("is exact for the timezones this CRM is actually read in", async () => {
    await commands.setTimezone("America/Denver");
    const now = new Date("2026-06-15T18:00:00.000Z");
    const dueDate = computePostponeDueDate(now, 1);

    for (const timezoneId of ["America/Denver", "America/New_York", "UTC"]) {
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
