import { describe, expect, it } from "vitest";

import { labelForAnswerKey } from "./answerLabels";

describe("labelForAnswerKey", () => {
  it("returns the explicit question for a known key", () => {
    expect(labelForAnswerKey("why_this_program")).toBe("Why this program?");
    expect(labelForAnswerKey("why_this_cohort")).toBe("Why this cohort?");
    expect(labelForAnswerKey("availability")).toBe("Availability");
  });

  it("humanizes an unknown snake_case key into Title Case, never raw", () => {
    expect(labelForAnswerKey("preferred_start_date")).toBe(
      "Preferred Start Date",
    );
  });

  it("humanizes an unknown kebab-case key", () => {
    expect(labelForAnswerKey("preferred-start-date")).toBe(
      "Preferred Start Date",
    );
  });

  it("never returns the raw key verbatim for an unknown multi-word key", () => {
    const raw = "some_future_question_key";
    expect(labelForAnswerKey(raw)).not.toBe(raw);
  });
});
