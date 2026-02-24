import { describe, it, expect } from "vitest";
import {
  isOverdue,
  isDueToday,
  isDueTomorrow,
  isDueThisWeek,
  isDueLater,
  endOfTodayDate,
  endOfTomorrowDate,
  endOfWeekDate,
  startOfTodayDate,
} from "./tasksPredicate";

const today = new Date();

describe("tasksPredicate", () => {
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
      today.getTime() + 3 * 24 * 60 * 60 * 1000,
    ).toISOString();
    expect(isDueLater(thisWeek)).toBe(false);
  });

  describe("boundaries", () => {
    it("should consider date equal to start of today as due today only", () => {
      const startOfToday = startOfTodayDate.toISOString();
      expect(isOverdue(startOfToday)).toBe(false);
      expect(isDueToday(startOfToday)).toBe(true);
      expect(isDueTomorrow(startOfToday)).toBe(false);
      expect(isDueThisWeek(startOfToday)).toBe(false);
      expect(isDueLater(startOfToday)).toBe(false);
    });

    it("should consider date equal to start of today minus 1 ms as overdue only", () => {
      const justBeforeStartOfToday = new Date(
        startOfTodayDate.getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeStartOfToday)).toBe(true);
      expect(isDueToday(justBeforeStartOfToday)).toBe(false);
      expect(isDueTomorrow(justBeforeStartOfToday)).toBe(false);
      expect(isDueThisWeek(justBeforeStartOfToday)).toBe(false);
      expect(isDueLater(justBeforeStartOfToday)).toBe(false);
    });

    it("should consider date equal to end of today as due tomorrow only", () => {
      const endOfToday = endOfTodayDate.toISOString();
      expect(isOverdue(endOfToday)).toBe(false);
      expect(isDueToday(endOfToday)).toBe(false);
      expect(isDueTomorrow(endOfToday)).toBe(true);
      expect(isDueThisWeek(endOfToday)).toBe(false);
      expect(isDueLater(endOfToday)).toBe(false);
    });

    it("should consider date equal to end of today minus 1 ms as due today only", () => {
      const justBeforeEndOfToday = new Date(
        endOfTodayDate.getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeEndOfToday)).toBe(false);
      expect(isDueToday(justBeforeEndOfToday)).toBe(true);
      expect(isDueTomorrow(justBeforeEndOfToday)).toBe(false);
      expect(isDueThisWeek(justBeforeEndOfToday)).toBe(false);
      expect(isDueLater(justBeforeEndOfToday)).toBe(false);
    });

    it("should consider date equal to end of tomorrow as due this week only", () => {
      const endOfTomorrow = endOfTomorrowDate.toISOString();
      expect(isOverdue(endOfTomorrow)).toBe(false);
      expect(isDueToday(endOfTomorrow)).toBe(false);
      expect(isDueTomorrow(endOfTomorrow)).toBe(false);
      expect(isDueThisWeek(endOfTomorrow)).toBe(true);
      expect(isDueLater(endOfTomorrow)).toBe(false);
    });

    it("should consider date equal to end of tomorrow minus 1 ms as due tomorrow only", () => {
      const justBeforeEndOfTomorrow = new Date(
        endOfTomorrowDate.getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeEndOfTomorrow)).toBe(false);
      expect(isDueToday(justBeforeEndOfTomorrow)).toBe(false);
      expect(isDueTomorrow(justBeforeEndOfTomorrow)).toBe(true);
      expect(isDueThisWeek(justBeforeEndOfTomorrow)).toBe(false);
      expect(isDueLater(justBeforeEndOfTomorrow)).toBe(false);
    });

    it("should consider date equal to end of week as due later only", () => {
      const endOfWeek = new Date(endOfWeekDate).toISOString();
      expect(isOverdue(endOfWeek)).toBe(false);
      expect(isDueToday(endOfWeek)).toBe(false);
      expect(isDueTomorrow(endOfWeek)).toBe(false);
      expect(isDueThisWeek(endOfWeek)).toBe(false);
      expect(isDueLater(endOfWeek)).toBe(true);
    });

    it("should consider date equal to end of week minus 1 ms as due this week only", () => {
      const justBeforeEndOfWeek = new Date(
        endOfWeekDate.getTime() - 1,
      ).toISOString();
      expect(isOverdue(justBeforeEndOfWeek)).toBe(false);
      expect(isDueToday(justBeforeEndOfWeek)).toBe(false);
      expect(isDueTomorrow(justBeforeEndOfWeek)).toBe(false);
      expect(isDueThisWeek(justBeforeEndOfWeek)).toBe(true);
      expect(isDueLater(justBeforeEndOfWeek)).toBe(false);
    });

    it("should consider date equal to two days from now as due this week only if today is before Friday", () => {
      const twoDaysFromNow = new Date(
        today.getTime() + 2 * 24 * 60 * 60 * 1000,
      ).toISOString();
      expect(isOverdue(twoDaysFromNow)).toBe(false);
      expect(isDueToday(twoDaysFromNow)).toBe(false);
      expect(isDueTomorrow(twoDaysFromNow)).toBe(false);
      expect(isDueThisWeek(twoDaysFromNow)).toBe(true);
      expect(isDueLater(twoDaysFromNow)).toBe(false);
    });
  });
});
