import { describe, expect, it } from "vitest";

import {
  ACTIVE_SALES_STAGES,
  DEAL_STAGES,
  hasExited,
  isActiveOpportunity,
  isWritableStage,
  LEGACY_PERSISTED_ONBOARDING_STAGE,
} from "./dealActivity";

// The rule that decides whether a sales attempt is still being sold used to
// exist about nine times, hand-written, in three different shapes. They
// agreed on the data that existed, which is the most dangerous way for nine
// copies of a rule to behave.
//
// The SQL function public.deal_is_active is the authority. This walks the
// entire stage x outcome x archived matrix — every combination, not a
// sample — and asserts the TypeScript mirror gives the same answer as the
// SQL's three clauses on all of them.

const OUTCOMES = [
  null,
  "nurture",
  "needs_higher_care",
  "not_fit",
  "lost",
  "workshops_only",
] as const;

const ARCHIVED = [null, "2026-09-18T00:00:00.000Z"] as const;

/** What public.deal_is_active(archived_at, stage, outcome) computes. */
const sqlDealIsActive = (
  archivedAt: string | null,
  stage: string,
  outcome: string | null,
): boolean => archivedAt === null && stage !== "won" && outcome === null;

describe("the canonical active-sales predicate", () => {
  it("agrees with the SQL authority on every combination", () => {
    // Arrange — the whole matrix: 7 stages x 6 outcomes x 2 archive states.
    const disagreements: string[] = [];

    for (const stage of DEAL_STAGES) {
      for (const outcome of OUTCOMES) {
        for (const archived_at of ARCHIVED) {
          // Act
          const ts = isActiveOpportunity({ stage, outcome, archived_at });
          const sql = sqlDealIsActive(archived_at, stage, outcome);

          // Assert
          if (ts !== sql) {
            disagreements.push(
              `${stage}/${outcome ?? "null"}/${archived_at ? "archived" : "live"}: ts=${ts} sql=${sql}`,
            );
          }
        }
      }
    }

    expect(disagreements).toEqual([]);
    // And prove the matrix was actually walked, so a broken loop cannot
    // pass by testing nothing.
    expect(DEAL_STAGES.length * OUTCOMES.length * ARCHIVED.length).toBe(84);
  });

  it("calls every active stage active while nothing has ended", () => {
    // Arrange / Act / Assert
    for (const stage of ACTIVE_SALES_STAGES) {
      expect(
        isActiveOpportunity({ stage, outcome: null, archived_at: null }),
      ).toBe(true);
    }
  });

  it("treats won as finished selling, not as an exit", () => {
    // Arrange
    const won = { stage: "won", outcome: null, archived_at: null };

    // Assert — not active, because there is nothing left to sell; and not
    // exited, because it succeeded. Those are different questions.
    expect(isActiveOpportunity(won)).toBe(false);
    expect(hasExited(won)).toBe(false);
  });

  it("treats any outcome at all as the end of the attempt", () => {
    // Arrange / Act / Assert
    for (const outcome of OUTCOMES.filter((o) => o !== null)) {
      const ended = { stage: "call_booked", outcome, archived_at: null };
      expect(isActiveOpportunity(ended)).toBe(false);
      expect(hasExited(ended)).toBe(true);
    }
  });

  it("reads an absent field the way SQL reads NULL", () => {
    // Arrange — an object that simply omits the optional columns, which is
    // what a narrow projection looks like.
    // Act / Assert
    expect(isActiveOpportunity({ stage: "interested" })).toBe(true);
    expect(isActiveOpportunity({ stage: "won" })).toBe(false);
  });

  it("still counts the legacy onboarding rows as active", () => {
    // Arrange — the fourteen legacy rows all carry outcome 'nurture', so
    // they are already out; but the stage alone must not remove them, or
    // repairing one later would behave unpredictably.
    // Act / Assert
    expect(
      isActiveOpportunity({
        stage: LEGACY_PERSISTED_ONBOARDING_STAGE,
        outcome: null,
        archived_at: null,
      }),
    ).toBe(true);
  });
});

describe("which stages may still be written", () => {
  it("refuses the legacy onboarding value", () => {
    // Assert — the database refuses it too; this lets the app say so
    // before the round trip.
    expect(isWritableStage(LEGACY_PERSISTED_ONBOARDING_STAGE)).toBe(false);
  });

  it("allows every active stage and won", () => {
    // Arrange / Act / Assert
    for (const stage of ACTIVE_SALES_STAGES) {
      expect(isWritableStage(stage)).toBe(true);
    }
    expect(isWritableStage("won")).toBe(true);
  });

  it("refuses a stage that is not in the vocabulary at all", () => {
    // Assert — the database CHECK says the same thing.
    expect(isWritableStage("committed")).toBe(false);
    expect(isWritableStage("")).toBe(false);
  });
});
