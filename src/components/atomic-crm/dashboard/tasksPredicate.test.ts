import { describe, it, expect, beforeEach, afterEach, vi } from "vitest";
import {
  isOverdue,
  isDueToday,
  isDueTomorrow,
  isDueThisWeek,
  isDueLater,
} from "./tasksPredicate";
import { startOfToday } from "date-fns/startOfToday";
import { endOfToday } from "date-fns/endOfToday";
import { endOfTomorrow } from "date-fns/endOfTomorrow";
import { endOfWeek } from "date-fns/endOfWeek";

describe("tasksPredicate", () => {
  // Fixed TUesday: 2026-02-25
  const WEDNESDAY = new Date("2026-02-24T12:00:00Z");
  let today: Date;

  beforeEach(() => {
    vi.setSystemTime(WEDNESDAY);

    today = new Date();
  });

  afterEach(() => {
    vi.useRealTimers();
  });
  it("isOverdue returns true for date in the past", () => {
    const overdue = new Date(
      today.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isOverdue(overdue)).toBe(true);
  });

  it("isOverdue returns false for task with due_date in the future", () => {
    const futureDate = new Date(
      today.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isOverdue(futureDate)).toBe(false);
  });

  it("isDueToday returns true for date before the end of the current day", () => {
    expect(isDueToday(today.toISOString())).toBe(true);
  });

  it("isDueToday returns false for due_date after the end of the current day", () => {
    const futureDate = new Date(
      today.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueToday(futureDate)).toBe(false);
  });

  it("isDueToday returns false for dueDate in the past", () => {
    const pastDate = new Date(
      today.getTime() - 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueToday(pastDate)).toBe(false);
  });

  it("isDueTomorrow returns true for tomorrow date", () => {
    const tomorrow = new Date(
      today.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueTomorrow(tomorrow)).toBe(true);
  });

  it("isDueTomorrow returns false for due_date after the end of tomorrow", () => {
    const afterTomorrow = new Date(
      today.getTime() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueTomorrow(afterTomorrow)).toBe(false);
  });

  it("isDueTomorrow returns false for due_date before the end of today", () => {
    const t = today.toISOString();
    expect(isDueTomorrow(t)).toBe(false);
  });

  it("isDueThisWeek returns true for 3 days from now", () => {
    const thisWeek = new Date(
      today.getTime() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueThisWeek(thisWeek)).toBe(true);
  });

  it("isDueThisWeek returns false for due_date after the end of the week", () => {
    const afterThisWeek = new Date(
      today.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueThisWeek(afterThisWeek)).toBe(false);
  });

  it("isDueThisWeek returns false for due_date before the end of tomorrow", () => {
    const tomorrow = new Date(
      today.getTime() + 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueThisWeek(tomorrow)).toBe(false);
  });

  it("isDueLater returns true for 7 days from now", () => {
    const later = new Date(
      today.getTime() + 7 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueLater(later)).toBe(true);
  });

  it("isDueLater returns false for due_date before the end of the week", () => {
    const thisWeek = new Date(
      today.getTime() + 2 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueLater(thisWeek)).toBe(false);
  });

  describe("boundaries", () => {
    it("should consider date equal to start of today as due today only", () => {
      const startOfTodayDate = startOfToday().toISOString();
      expect(isOverdue(startOfTodayDate)).toBe(false);
      expect(isDueToday(startOfTodayDate)).toBe(true);
      expect(isDueTomorrow(startOfTodayDate)).toBe(false);
      expect(isDueThisWeek(startOfTodayDate)).toBe(false);
      expect(isDueLater(startOfTodayDate)).toBe(false);
    });

    it("should consider date equal to start of today minus 1 ms as overdue only", () => {
      const justBeforeStartOfToday = new Date(
        startOfToday().getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeStartOfToday)).toBe(true);
      expect(isDueToday(justBeforeStartOfToday)).toBe(false);
      expect(isDueTomorrow(justBeforeStartOfToday)).toBe(false);
      expect(isDueThisWeek(justBeforeStartOfToday)).toBe(false);
      expect(isDueLater(justBeforeStartOfToday)).toBe(false);
    });

    it("should consider date equal to end of today as due tomorrow only", () => {
      const endOfTodayDate = endOfToday().toISOString();
      expect(isOverdue(endOfTodayDate)).toBe(false);
      expect(isDueToday(endOfTodayDate)).toBe(false);
      expect(isDueTomorrow(endOfTodayDate)).toBe(true);
      expect(isDueThisWeek(endOfTodayDate)).toBe(false);
      expect(isDueLater(endOfTodayDate)).toBe(false);
    });

    it("should consider date equal to end of today minus 1 ms as due today only", () => {
      const justBeforeEndOfToday = new Date(
        endOfToday().getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeEndOfToday)).toBe(false);
      expect(isDueToday(justBeforeEndOfToday)).toBe(true);
      expect(isDueTomorrow(justBeforeEndOfToday)).toBe(false);
      expect(isDueThisWeek(justBeforeEndOfToday)).toBe(false);
      expect(isDueLater(justBeforeEndOfToday)).toBe(false);
    });

    it("should consider date equal to end of tomorrow as due this week only", () => {
      const endOfTomorrowDate = endOfTomorrow().toISOString();
      expect(isOverdue(endOfTomorrowDate)).toBe(false);
      expect(isDueToday(endOfTomorrowDate)).toBe(false);
      expect(isDueTomorrow(endOfTomorrowDate)).toBe(false);
      expect(isDueThisWeek(endOfTomorrowDate)).toBe(true);
      expect(isDueLater(endOfTomorrowDate)).toBe(false);
    });

    it("should consider date equal to end of tomorrow minus 1 ms as due tomorrow only", () => {
      const justBeforeEndOfTomorrow = new Date(
        endOfTomorrow().getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeEndOfTomorrow)).toBe(false);
      expect(isDueToday(justBeforeEndOfTomorrow)).toBe(false);
      expect(isDueTomorrow(justBeforeEndOfTomorrow)).toBe(true);
      expect(isDueThisWeek(justBeforeEndOfTomorrow)).toBe(false);
      expect(isDueLater(justBeforeEndOfTomorrow)).toBe(false);
    });

    it("should consider date equal to end of week as due later only", () => {
      const endOfWeekDate = endOfWeek(new Date(), {
        weekStartsOn: 0,
      }).toISOString();
      expect(isOverdue(endOfWeekDate)).toBe(false);
      expect(isDueToday(endOfWeekDate)).toBe(false);
      expect(isDueTomorrow(endOfWeekDate)).toBe(false);
      expect(isDueThisWeek(endOfWeekDate)).toBe(false);
      expect(isDueLater(endOfWeekDate)).toBe(true);
    });

    it("should consider date equal to end of week minus 1 ms as due this week only", () => {
      const justBeforeEndOfWeek = new Date(
        endOfWeek(new Date(), { weekStartsOn: 0 }).getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeEndOfWeek)).toBe(false);
      expect(isDueToday(justBeforeEndOfWeek)).toBe(false);
      expect(isDueTomorrow(justBeforeEndOfWeek)).toBe(false);
      expect(isDueThisWeek(justBeforeEndOfWeek)).toBe(true);
      expect(isDueLater(justBeforeEndOfWeek)).toBe(false);
    });

    it("should consider date equal to two days from now as due this week only if today is before Friday", () => {
      const twoDaysFromNow = new Date(
        new Date().getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(isOverdue(twoDaysFromNow)).toBe(false);
      expect(isDueToday(twoDaysFromNow)).toBe(false);
      expect(isDueTomorrow(twoDaysFromNow)).toBe(false);
      expect(isDueThisWeek(twoDaysFromNow)).toBe(true);
      expect(isDueLater(twoDaysFromNow)).toBe(false);
    });
  });
});
