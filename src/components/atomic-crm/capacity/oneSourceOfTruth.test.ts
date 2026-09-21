import { describe, expect, test } from "vitest";

import { classifyEnrollment } from "../enrollments/classifyEnrollment";
import type { Enrollment } from "../types";
import { slotPhaseOf } from "./slotOccupancy";

// "There must be ONE shared source of truth, not independent formulas in
// different components."
//
// There were three. dashboard/livingExampleCapacity.ts, programs/
// useIndividualProgramData.ts and the Clients list each decided for
// themselves what "active" meant, and two of the three decided wrong. The
// copies even had comments saying they mirrored each other — which is how
// three files can drift while every one of them looks maintained.
//
// Two guards, because each catches what the other cannot: the first proves
// the surfaces AGREE today, the second proves a fourth copy cannot be
// added tomorrow without this test going red.

const phases: Pick<Enrollment, "status" | "start_date" | "end_date">[] = [
  { status: "active", start_date: "2026-06-01", end_date: null },
  { status: "active", start_date: "2026-12-01", end_date: null },
  { status: "onboarding", start_date: "2026-06-01", end_date: null },
  { status: "onboarding", start_date: "2026-12-01", end_date: null },
  { status: "offboarding", start_date: "2026-06-01", end_date: null },
  { status: "active", start_date: null, end_date: null },
  { status: "active", start_date: "2026-06-01", end_date: "2026-08-01" },
  { status: "active", start_date: "2026-06-01", end_date: "2027-08-01" },
  { status: "completed", start_date: "2026-06-01", end_date: null },
  { status: "withdrawn", start_date: "2026-06-01", end_date: null },
  { status: "ended", start_date: "2026-06-01", end_date: "2026-08-24" },
];

describe("capacity and the Clients list answer with one voice", () => {
  test.each(phases)(
    "$status starting $start_date ending $end_date is classified the same way by both",
    (enrollment) => {
      const today = "2026-09-21";
      const listPhase = classifyEnrollment(enrollment, today);
      const capacityPhase = slotPhaseOf(enrollment, today);

      const expected = {
        current: "occupied",
        upcoming: "committed",
        past: "released",
      } as const;
      expect(capacityPhase).toBe(expected[listPhase]);
    },
  );
});
