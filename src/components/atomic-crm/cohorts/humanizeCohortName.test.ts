import { describe, expect, it } from "vitest";

import { humanizeCohortName } from "./humanizeCohortName";

describe("humanizeCohortName", () => {
  it("strips the offer's own initials from the cohort name", () => {
    expect(
      humanizeCohortName("September GYU Cohort", "Growing Yourself Up"),
    ).toBe("September Cohort");
  });

  it("strips the initials wherever they appear, not just at a fixed position", () => {
    expect(humanizeCohortName("GYU Info Session", "Growing Yourself Up")).toBe(
      "Info Session",
    );
  });

  it("never mutates the cohort name when no redundant token is present", () => {
    expect(humanizeCohortName("Fall Intensive", "Growing Yourself Up")).toBe(
      "Fall Intensive",
    );
  });

  it("does not strip anything for a single-word offer name (too short an initials token to be meaningful)", () => {
    expect(humanizeCohortName("September Cohort", "Workshop")).toBe(
      "September Cohort",
    );
  });

  it("does not corrupt a name that only partially overlaps the initials", () => {
    expect(humanizeCohortName("Growing Cohort", "Growing Yourself Up")).toBe(
      "Growing Cohort",
    );
  });
});
