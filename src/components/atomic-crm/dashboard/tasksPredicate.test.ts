import { describe, it, expect } from "vitest";
import {
  isOverdue,
  isDueToday,
  isDueTomorrow,
  isDueThisWeek,
  isDueLater,
} from "./tasksPredicate";

const today = new Date();
const iso = (d: Date) => d.toISOString();

const task = (due: Date, done: boolean = false) => ({
  id: 1,
  due_date: iso(due),
  done_date: done ? iso(today) : null,
});

describe("tasksPredicate", () => {
  it("isOverdue returns true for task with due_date in the past", () => {
    const overdue = task(new Date(today.getTime() - 86400000));
    expect(isOverdue(overdue)).toBe(true);
  });

  it("isOverdue returns false for task with due_date in the future", () => {
    const notOverdue = task(new Date(today.getTime() + 86400000));
    expect(isOverdue(notOverdue)).toBe(false);
  });

  it("isOverdue returns false for done", () => {
    const done = task(today, true);
    expect(isOverdue(done)).toBe(false);
  });

  it("isDueToday returns true for due_date before the end of the current day", () => {
    const t = task(today);
    expect(isDueToday(t)).toBe(true);
  });

  it("isDueToday returns false for due_date after the end of the current day", () => {
    const t = task(new Date(today.getTime() + 86400000));
    expect(isDueToday(t)).toBe(false);
  });

  it("isDueToday returns false for dueDate in the past", () => {
    const t = task(new Date(today.getTime() - 86400000));
    expect(isDueToday(t)).toBe(false);
  });

  it("isDueToday returns false for done", () => {
    const t = task(today, true);
    expect(isDueToday(t)).toBe(false);
  });

  it("isDueTomorrow returns true for tomorrow", () => {
    const tomorrow = task(new Date(today.getTime() + 86400000));
    expect(isDueTomorrow(tomorrow)).toBe(true);
  });

  it("isDueTomorrow returns false for due_date after the end of tomorrow", () => {
    const afterTomorrow = task(new Date(today.getTime() + 2 * 86400000));
    expect(isDueTomorrow(afterTomorrow)).toBe(false);
  });

  it("isDueTomorrow returns false for due_date before the end of today", () => {
    const t = task(today);
    expect(isDueTomorrow(t)).toBe(false);
  });

  it("isDueTomorrow returns false for done", () => {
    const tomorrow = task(new Date(today.getTime() + 86400000), true);
    expect(isDueTomorrow(tomorrow)).toBe(false);
  });

  it("isDueThisWeek returns true for 3 days from now", () => {
    const thisWeek = task(new Date(today.getTime() + 3 * 86400000));
    expect(isDueThisWeek(thisWeek)).toBe(true);
  });

  it("isDueThisWeek returns false for due_date after the end of the week", () => {
    const afterThisWeek = task(new Date(today.getTime() + 7 * 86400000));
    expect(isDueThisWeek(afterThisWeek)).toBe(false);
  });

  it("isDueThisWeek returns false for due_date before the end of tomorrow", () => {
    const tomorrow = task(new Date(today.getTime() + 86400000));
    expect(isDueThisWeek(tomorrow)).toBe(false);
  });

  it("isDueThisWeek returns false for done", () => {
    const thisWeek = task(new Date(today.getTime() + 3 * 86400000), true);
    expect(isDueThisWeek(thisWeek)).toBe(false);
  });

  it("isDueLater returns true for 7 days from now", () => {
    const later = task(new Date(today.getTime() + 7 * 86400000));
    expect(isDueLater(later)).toBe(true);
  });

  it("isDueLater returns false for due_date before the end of the week", () => {
    const thisWeek = task(new Date(today.getTime() + 3 * 86400000));
    expect(isDueLater(thisWeek)).toBe(false);
  });

  it("isDueLater returns false for done", () => {
    const later = task(new Date(today.getTime() + 7 * 86400000), true);
    expect(isDueLater(later)).toBe(false);
  });
});
