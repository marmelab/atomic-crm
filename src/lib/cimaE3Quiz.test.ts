import { describe, expect, it, vi } from "vitest";
import {
  formatBreakTime,
  getNextQuestionIndex,
  getQuestions,
  getRandomQuestionIndex,
} from "./cimaE3Quiz";

describe("cimaE3Quiz helpers", () => {
  it("advances question indices in a cycle", () => {
    expect(getNextQuestionIndex(0, 3)).toBe(1);
    expect(getNextQuestionIndex(2, 3)).toBe(0);
  });

  it("formats remaining break time as mm:ss", () => {
    expect(formatBreakTime(65)).toBe("01:05");
    expect(formatBreakTime(600)).toBe("10:00");
  });

  it("returns a practical set of strategic management questions", () => {
    const questions = getQuestions();

    expect(questions.length).toBeGreaterThan(5);
    expect(questions[0]?.topic).toContain("Strategic");
  });

  it("picks a different random question index when possible", () => {
    vi.spyOn(Math, "random").mockReturnValue(0.75);

    expect(getRandomQuestionIndex(0, 4)).toBe(3);

    vi.restoreAllMocks();
  });
});
