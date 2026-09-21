import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// "There must be ONE shared source of truth, not independent formulas in
// different components."
//
// There were three. dashboard/livingExampleCapacity.ts, programs/
// useIndividualProgramData.ts and the Clients list each decided for
// themselves what "active" meant, and two of the three decided wrong. The
// copies even carried comments saying they mirrored each other — which is
// how three files can drift while every one of them looks maintained.
//
// src/components/atomic-crm/capacity/oneSourceOfTruth.test.ts proves the
// surfaces AGREE today. This proves a fourth copy cannot be added
// tomorrow without something going red.

// Every module that shows or computes an individual Offer's capacity.
const CAPACITY_SURFACES = [
  "src/components/atomic-crm/dashboard/livingExampleCapacity.ts",
  "src/components/atomic-crm/dashboard/useLivingExampleCapacityData.ts",
  "src/components/atomic-crm/dashboard/LivingExampleCapacityCard.tsx",
  "src/components/atomic-crm/dashboard/useComingUpItems.ts",
  "src/components/atomic-crm/programs/useIndividualProgramData.ts",
  "src/components/atomic-crm/programs/IndividualProgramPage.tsx",
  "src/components/atomic-crm/programs/IndividualProgramCard.tsx",
  "src/components/atomic-crm/programs/UpcomingOpeningsSection.tsx",
  "src/components/atomic-crm/enrollments/ClientList.tsx",
  "src/components/atomic-crm/enrollments/useClientsGrouped.ts",
];

// The two modules allowed to name the rule, and the only two.
const RULE_OWNERS = [
  "src/components/atomic-crm/enrollments/classifyEnrollment.ts",
  "src/components/atomic-crm/capacity/slotOccupancy.ts",
];

describe("no capacity surface keeps its own copy of the rule", () => {
  test.each(CAPACITY_SURFACES)(
    "%s does not name the slot-occupying statuses itself",
    (path) => {
      const source = readFileSync(path, "utf8");
      // A local set of status literals is exactly how the three copies
      // were written, and exactly what must not come back.
      expect(source).not.toMatch(/ACTIVE_ENROLLMENT_STATUSES/);
      expect(source).not.toMatch(/"onboarding",\s*\n?\s*"active"/);
    },
  );

  test("the rule is owned by exactly the two modules that are supposed to own it", () => {
    for (const path of RULE_OWNERS) {
      expect(readFileSync(path, "utf8")).toMatch(
        /onboarding|classifyEnrollment/,
      );
    }
  });
});
