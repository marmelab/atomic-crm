import { readFileSync } from "node:fs";
import { describe, expect, test } from "vitest";

// "A future UI cannot independently say November while the ledger says
// October."
//
// The previous pass proved the surfaces agree on WHO is active. It did not
// stop them disagreeing about WHEN — and they did: the ledger's first
// month with a positive balance was October, and the report said November.
// That one was a human reading the wrong number off a test, but nothing in
// the repository would have caught a component computing it for itself.
//
// So this fixes the shape of the answer, not just the rule behind it.
// Every surface that shows occupancy or an opening must read the canonical
// output; none may derive one.

// Surfaces that display capacity, occupancy or openings.
const SURFACES = [
  "src/components/atomic-crm/dashboard/livingExampleCapacity.ts",
  "src/components/atomic-crm/dashboard/useLivingExampleCapacityData.ts",
  "src/components/atomic-crm/dashboard/LivingExampleCapacityCard.tsx",
  "src/components/atomic-crm/dashboard/useComingUpItems.ts",
  "src/components/atomic-crm/dashboard/comingUpProjection.ts",
  "src/components/atomic-crm/programs/useIndividualProgramData.ts",
  "src/components/atomic-crm/programs/IndividualProgramPage.tsx",
  "src/components/atomic-crm/programs/IndividualProgramCard.tsx",
  "src/components/atomic-crm/programs/UpcomingOpeningsSection.tsx",
];

// The modules allowed to work the answer out. Everything else consumes it.
const AUTHORITIES = [
  "src/components/atomic-crm/capacity/occupancyLedger.ts",
  "src/components/atomic-crm/capacity/individualCapacity.ts",
];

const read = (path: string) => readFileSync(path, "utf8");

describe("one capacity answer, consumed everywhere", () => {
  test.each(SURFACES)("%s does not compute an opening of its own", (path) => {
    const source = read(path);
    // The arithmetic that produced three different answers: a ceiling
    // minus a count, anywhere outside capacity/.
    expect(source).not.toMatch(/max_active_clients\s*-\s/);
    expect(source).not.toMatch(/\bmax\s*-\s*(active|occupied|capacity\.)/);
    // Nor its own notion of which statuses occupy a slot.
    expect(source).not.toMatch(/ACTIVE_ENROLLMENT_STATUSES/);
    expect(source).not.toMatch(/"onboarding",\s*\n?\s*"active"/);
  });

  test.each(SURFACES)("%s does not build its own event ledger", (path) => {
    const source = read(path);
    // Simulating occupancy anywhere but capacity/ is how two surfaces end
    // up naming different months.
    expect(source).not.toMatch(/occupiedAfter\s*[=+-]/);
    expect(source).not.toMatch(/peakOccupancyBetween\(/);
    expect(source).not.toMatch(/buildSlotEvents\(/);
  });

  test("the ledger and the summary are the only authorities", () => {
    for (const path of AUTHORITIES) {
      expect(read(path)).toMatch(/max|occupied/);
    }
    // And the ledger is where the definition of an opening actually lives.
    expect(read(AUTHORITIES[0]!)).toMatch(/safeOpeningsStartingOn/);
  });

  test("the dashboard's next opening is the ledger's first month with an opening", () => {
    // Read as source rather than asserted through a rendered page: the
    // point is that no other rule can be written here, not that one
    // fixture happens to agree today.
    const source = read(
      "src/components/atomic-crm/dashboard/livingExampleCapacity.ts",
    );
    expect(source).toMatch(/months\.find\(\(month\) => month\.openings > 0\)/);
  });

  test("Coming Up announces only months that are actually open", () => {
    const source = read(
      "src/components/atomic-crm/dashboard/comingUpProjection.ts",
    );
    expect(source).toMatch(/\.filter\(\(month\) => month\.openings > 0\)/);
  });
});
