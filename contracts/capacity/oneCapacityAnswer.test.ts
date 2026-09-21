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
  "src/components/atomic-crm/capacity/sessionWeeks.ts",
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
    // And the end-date arithmetic the calendar replaced. Nobody derives a
    // finishing date from the Offer's "4 months" any more — the container
    // is twelve eligible `1:1s` weeks, and only sessionWeeks.ts says so.
    expect(source).not.toMatch(/duration_months/);
    expect(source).not.toMatch(/addMonths\(/);
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

  test("the calendar engine, the ledger and the summary are the only authorities", () => {
    for (const path of AUTHORITIES) {
      expect(read(path)).toMatch(/max|occupied|weeks/);
    }
    // The twelve-week rule lives in exactly one place.
    expect(read(AUTHORITIES[0]!)).toMatch(/SESSIONS_PER_CONTAINER = 12/);
    // And the definition of an opening in exactly one other.
    expect(read(AUTHORITIES[1]!)).toMatch(/safeOpeningsStartingOn/);
  });

  test.each(SURFACES)("%s does not count session weeks itself", (path) => {
    const source = read(path);
    // Twelve is the business model, and a second copy of it anywhere is
    // how the CRM ends up with two different finishing weeks for one
    // person.
    expect(source).not.toMatch(/\b12\b\s*(-|\*|weeks)/);
    expect(source).not.toMatch(/SESSIONS_PER_CONTAINER\s*=/);
  });

  test("the dashboard's next opening is the ledger's first month with an opening", () => {
    // Read as source rather than asserted through a rendered page: the
    // point is that no other rule can be written here, not that one
    // fixture happens to agree today.
    const source = read(
      "src/components/atomic-crm/dashboard/livingExampleCapacity.ts",
    );
    expect(source).toMatch(
      /months\.find\(\s*\(month\) =>\s*month\.openings\.status === "known" && month\.openings\.openings > 0,?\s*\)/,
    );
  });

  test("Coming Up announces only months that are actually open", () => {
    const source = read(
      "src/components/atomic-crm/dashboard/comingUpProjection.ts",
    );
    expect(source).toMatch(
      /month\.openings\.status === "known" && month\.openings\.openings > 0/,
    );
  });
});
