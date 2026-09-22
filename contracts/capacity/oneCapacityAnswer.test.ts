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
  // The comprehension repair added four more surfaces. Every one of them
  // renders an answer; none of them may work one out.
  "src/components/atomic-crm/capacity/AvailabilityAnswer.tsx",
  "src/components/atomic-crm/capacity/MonthBreakdownDialog.tsx",
  "src/components/atomic-crm/capacity/WeekBreakdown.tsx",
  "src/components/atomic-crm/capacity/OccupancyBar.tsx",
];

// The modules allowed to work the answer out. Everything else consumes it.
const AUTHORITIES = [
  "src/components/atomic-crm/capacity/sessionWeeks.ts",
  "src/components/atomic-crm/capacity/occupancyLedger.ts",
  "src/components/atomic-crm/capacity/individualCapacity.ts",
  // Arranges the canonical answers by week and by month so a screen can
  // show them. It decides nothing: see the assertion below.
  "src/components/atomic-crm/capacity/weekCapacity.ts",
  "src/components/atomic-crm/capacity/openingsNarrative.ts",
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
    // Arithmetic on twelve, not prose about it: "12-session schedule"
    // and "the 12 1:1 weeks it needs" are copy, and copy is the point of
    // this whole repair.
    expect(source).not.toMatch(/\b12\b\s*(?:\*|-(?!\w)|weeks)/);
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

// The comprehension repair, which is where a second engine would most
// plausibly appear: a screen that has to EXPLAIN an answer is one small
// step from working the answer out again in order to explain it.
describe("the explanation comes from the evaluation, not beside it", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  test("the week model arranges canonical answers and computes none", () => {
    const source = read("src/components/atomic-crm/capacity/weekCapacity.ts");
    // Every number it carries comes from a call into the ledger.
    expect(source).toMatch(/peakBetween\(/);
    expect(source).toMatch(/explainSafeStart\(/);
    // And none of them is worked out here.
    expect(source).not.toMatch(/occupied\s*\+=/);
    expect(source).not.toMatch(/SESSIONS_PER_CONTAINER\s*=/);
    expect(source).not.toMatch(/computeExpectedEnd\(/);
  });

  test("the narrative reads the week model and decides nothing itself", () => {
    const source = read(
      "src/components/atomic-crm/capacity/openingsNarrative.ts",
    );
    // Whether a week is sellable is asked, never re-derived. In
    // particular the two halves of an opening — the ceiling AND the
    // calendar — are not re-tested here.
    expect(source).toMatch(/isSafeOpening/);
    expect(source).not.toMatch(/computeExpectedEnd\(/);
    expect(source).not.toMatch(/peakBetween\(/);
    expect(source).not.toMatch(/max\s*-\s*peak/);
  });

  test("a month card and the headline are the same function", () => {
    // Not "they agree": there is one way to produce either. If a month
    // ever gets its own summariser, this goes red.
    const source = read(
      "src/components/atomic-crm/capacity/openingsNarrative.ts",
    );
    expect(source).toMatch(/availability: describeAvailability\(monthWeeks/);
  });

  test("the safe-start explanation is returned by the thing that decided it", () => {
    const source = read(
      "src/components/atomic-crm/capacity/occupancyLedger.ts",
    );
    // One walk produces the peak, when it happens and who causes it, so
    // a screen can never narrate a different reason from the number.
    expect(source).toMatch(/export const peakBetween/);
    expect(source).toMatch(/contributors: SlotHolder\[\]/);
    expect(source).toMatch(
      /explainSafeStart\(events, occupiedToday, max, date, weeks\)\.answer/s,
    );
  });

  test("one component renders the openings answer", () => {
    // The production defect was `count: capacity.openings`, where
    // `openings` is the ANSWER OBJECT — it rendered "[object Object]
    // openings" on the dashboard, the Programs hub and the program page.
    //
    // A regex cannot catch that honestly: `count: capacity.openings` and
    // the correct `count: capacity.openings.openings` differ by one
    // property, and translate() takes `any`, which is why TypeScript did
    // not catch it either. So the rule asserted here is the one that
    // actually prevents it — the message key has exactly one renderer, and
    // that renderer takes a typed OpeningsAnswer and narrows it.
    const renderers = SURFACES.filter((path) =>
      read(path).includes("crm.dashboard.capacity_openings"),
    );
    expect(renderers).toEqual([]);

    const line = read("src/components/atomic-crm/capacity/OpeningsLine.tsx");
    expect(line).toMatch(/openings: OpeningsAnswer/);
    expect(line).toMatch(/openings\.status === "unknown"/);
  });
});

// One week boundary, described the same way wherever it appears.
//
// Leif found the CRM saying, on one screen: "Erik Amundson — expected
// final session week Nov 29", "Week of Nov 29 — no finishes", and
// "earliest safe start: week of Nov 29". Three surfaces, one week, and
// they could not all be right.
//
// They can disagree because two different dates describe the same ending:
// the WEEK the twelfth session is in, and the DAY the slot is released —
// which is the day after that week, by construction. Occupancy needs the
// second; every sentence shown to a person needs the first.
describe("a finish is one week, whichever surface names it", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  test("the release date is the exclusive end of the final session week", () => {
    // Not "roughly a week later" — exactly that boundary, in one place.
    const source = read("src/components/atomic-crm/capacity/sessionWeeks.ts");
    expect(source).toMatch(/lastDay: dayBefore\(finalWeek\.end\)/);
    expect(source).toMatch(/freesOn: finalWeek\.end/);
  });

  test("the drilldown buckets a finish by the week, never by the release date", () => {
    // Bucketing by the release date put every finish outside its own week
    // and — because Year Tracking has gaps — usually outside every week,
    // so "Finishing" was empty on all of them.
    const source = read("src/components/atomic-crm/capacity/weekCapacity.ts");
    expect(source).toMatch(/lastDayOccupied/);
    expect(source).toMatch(/holder\.end\.lastDay/);
    // The old shape: an end event filtered by its own date.
    expect(source).not.toMatch(/kind === "end" && inWeek\(event\.date/);
  });

  test("nothing user-facing prints the release date as a week", () => {
    // `holdsSlotUntil` is the day AFTER the final session week. Rendering
    // it beside a client card reading "final session week Nov 29" is the
    // off-by-one this whole pass exists to remove, so the copy reads
    // `finalWeekStart` instead.
    const shown = [
      "src/components/atomic-crm/capacity/WeekBreakdown.tsx",
      "src/components/atomic-crm/capacity/AvailabilityAnswer.tsx",
      "src/components/atomic-crm/programs/UpcomingOpeningsSection.tsx",
    ];
    for (const path of shown) {
      expect(read(path)).not.toMatch(/weekLabel\(\s*holdsSlotUntil/);
    }
    expect(
      read("src/components/atomic-crm/capacity/WeekBreakdown.tsx"),
    ).toMatch(/weekLabel\(finalWeekStart\)/);
  });

  test("a week Leif is open is counted once, however many events describe it", () => {
    // Production holds two `1:1s` events for the week of 17 May 2026.
    // Counting it twice spends two of a client's twelve sessions on one
    // real week and ends them a week early.
    const source = read("src/components/atomic-crm/capacity/sessionWeeks.ts");
    expect(source).toMatch(/new Set<string>\(\)/);
    expect(source).toMatch(/seen\.has\(key\)/);
  });
});

// Two lists, two orders, and neither is the other reversed.
describe("client lists are ordered by what they are for", () => {
  const read = (path: string) => readFileSync(path, "utf8");

  test("current clients newest first, people still to start soonest first", () => {
    const source = read(
      "src/components/atomic-crm/capacity/individualCapacity.ts",
    );
    expect(source).toMatch(/occupied\.sort\(byStartDescThenName\)/);
    expect(source).toMatch(/committed\.sort\(byStartThenName\)/);
    // Never by a derived end date: that moves whenever Year Tracking
    // changes, so the list would silently reorder itself after a sync.
    expect(source).not.toMatch(/occupied\.sort\(byEndThenName\)/);
  });
});
