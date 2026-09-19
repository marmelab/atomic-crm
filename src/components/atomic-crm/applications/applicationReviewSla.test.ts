import { describe, expect, test } from "vitest";

import {
  describeReviewTiming,
  reviewDeadlineDateKey,
  reviewTiming,
  toCrmDateKey,
} from "./applicationReviewSla";

// Three CALENDAR days in Denver, not 72 hours. These pin the boundary,
// because "when does this become an exception" is the whole point.

describe("the three-day review window", () => {
  test("the day it arrives is day 0, however late in the day", () => {
    // Arrange — 11:30pm Denver on the 1st (= 06:30 UTC on the 2nd).
    const submitted = "2026-09-02T05:30:00Z";

    // Act / Assert — still day 0 in Denver, with all three days left.
    const timing = reviewTiming(submitted, "2026-09-02T05:40:00Z");
    expect(toCrmDateKey(submitted)).toBe("2026-09-01");
    expect(timing).toEqual({
      state: "within",
      daysElapsed: 0,
      daysRemaining: 3,
    });
  });

  test("days one, two and three are still within the window", () => {
    // Arrange
    const submitted = "2026-09-01T18:00:00Z";

    // Assert
    for (const [day, remaining] of [
      [1, 2],
      [2, 1],
      [3, 0],
    ]) {
      const timing = reviewTiming(submitted, `2026-09-0${1 + day}T18:00:00Z`);
      expect(timing.state, `day ${day}`).toBe("within");
      expect(timing).toMatchObject({
        daysElapsed: day,
        daysRemaining: remaining,
      });
    }
  });

  test("day four is the first overdue day", () => {
    // Arrange — the boundary the whole rule turns on.
    const submitted = "2026-09-01T18:00:00Z";

    // Act
    const lastGoodDay = reviewTiming(submitted, "2026-09-04T18:00:00Z");
    const firstLateDay = reviewTiming(submitted, "2026-09-05T18:00:00Z");

    // Assert
    expect(lastGoodDay).toEqual({
      state: "within",
      daysElapsed: 3,
      daysRemaining: 0,
    });
    expect(firstLateDay).toEqual({
      state: "overdue",
      daysElapsed: 4,
      daysOverdue: 1,
    });
  });

  test("an application is never overdue the moment it is submitted", () => {
    // Arrange — the bug this replaces: submitted_at was the Task's due
    // date, so yesterday's application showed as Overdue today.
    const now = "2026-09-19T16:00:00Z";

    // Assert
    expect(reviewTiming(now, now).state).toBe("within");
    expect(reviewTiming("2026-09-18T16:00:00Z", now).state).toBe("within");
  });

  test("the deadline is a date, so a clock change cannot move it", () => {
    // Arrange — US DST ends 2026-11-01. A 72-hour rule would land an hour
    // out across this boundary; a calendar rule cannot.
    const submitted = "2026-10-31T18:00:00Z";

    // Assert
    expect(reviewDeadlineDateKey(submitted)).toBe("2026-11-03");
    expect(reviewTiming(submitted, "2026-11-03T20:00:00Z").state).toBe(
      "within",
    );
    expect(reviewTiming(submitted, "2026-11-04T20:00:00Z")).toEqual({
      state: "overdue",
      daysElapsed: 4,
      daysOverdue: 1,
    });
  });

  test("midnight in Denver, not midnight in UTC, ends the day", () => {
    // Arrange — 00:30 UTC on the 5th is still the evening of the 4th in
    // Denver, so the day has not turned over yet.
    const submitted = "2026-09-01T18:00:00Z";

    // Assert
    expect(reviewTiming(submitted, "2026-09-05T00:30:00Z").state).toBe(
      "within",
    );
    expect(reviewTiming(submitted, "2026-09-05T07:30:00Z").state).toBe(
      "overdue",
    );
  });
});

describe("what the row says", () => {
  test("counts down inside the window and up outside it", () => {
    // Assert — never a raw timestamp Leif has to subtract from today.
    const at = (now: string) =>
      describeReviewTiming(reviewTiming("2026-09-01T18:00:00Z", now));

    expect(at("2026-09-02T18:00:00Z")).toBe("2 days remaining");
    expect(at("2026-09-03T18:00:00Z")).toBe("1 day remaining");
    expect(at("2026-09-04T18:00:00Z")).toBe("Due today");
    expect(at("2026-09-05T18:00:00Z")).toBe("Overdue by 1 day");
    expect(at("2026-09-07T18:00:00Z")).toBe("Overdue by 3 days");
  });
});
