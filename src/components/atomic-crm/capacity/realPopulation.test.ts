import { describe, expect, test } from "vitest";

import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "./individualCapacity";

// The Living Example, as it really stands on 21 September 2026.
//
// A golden scenario, not an illustration. Every name, every date and every
// provenance below is what production holds after Leif confirmed the six
// future Start Weeks; the assertions are the exact occupancy at every
// boundary through the end of January. If the arithmetic ever drifts, this
// is the file that says so in terms Leif can check by eye.
//
// It exists because the first version of this maths produced four numbers
// that could not all be true at once, and nothing in the suite noticed.

const NOW = new Date("2026-09-21T12:00:00Z");
const MAX = 12;
const FOUR_MONTHS = 4;

// The twelve people Leif is working with, with the Start Weeks he has
// stated. Three of these differ from what the CRM had inferred from their
// first booked session, and the differences move real slots:
//
//   Jules Litman-Cleper  24 Jun -> 20 May   (his projection is now
//                                            already overdue)
//   Gigi George          19 Jul -> 20 Jul
//   Mackenzie Stabler    29 Jul ->  3 Aug
const OCCUPIED: [string, string][] = [
  ["2026-05-20", "Jules Litman-Cleper"],
  ["2026-06-14", "Adriano Castro"],
  ["2026-06-14", "Jess Beauchamp"],
  ["2026-07-20", "Emily Loeb"],
  ["2026-07-20", "Gigi George"],
  ["2026-07-20", "Mia Cosme"],
  ["2026-07-20", "Morgan Schenkeveld"],
  ["2026-08-03", "Mackenzie Stabler"],
  ["2026-08-17", "Erik Amundson"],
  ["2026-08-17", "Sarah Monast"],
  ["2026-09-10", "Pete Bassett"],
  ["2026-09-16", "Gina McNamara"],
];

// The six Leif has stated. Denise's is the one that moved: her Enrollment
// said 30 September, which was her first booked session, and her Start
// Week is the first week of October.
const COMMITTED: [string, string][] = [
  ["2026-10-05", "Ava Frotton"],
  ["2026-10-05", "Denise Cormier"],
  ["2026-11-08", "Daniel Alexander"],
  ["2026-11-08", "Emma Wijns"],
  ["2026-11-08", "Heidi Elias"],
  ["2026-11-08", "Linda Turner"],
];

const population: SlotEnrollment[] = [
  ...OCCUPIED.map(([start, name], i) => ({
    id: i + 1,
    status: "active" as const,
    start_date: start,
    end_date: null,
    start_date_source: "owner" as const,
    name,
    contactId: i + 1,
  })),
  ...COMMITTED.map(([start, name], i) => ({
    id: 100 + i,
    status: "active" as const,
    start_date: start,
    end_date: null,
    start_date_source: "owner" as const,
    name,
    contactId: 100 + i,
  })),
];

const capacity = () =>
  computeIndividualCapacity(population, MAX, FOUR_MONTHS, NOW);

describe("the real Living Example, 21 September 2026", () => {
  test("twelve active, six committed, every Start Week owner-stated", () => {
    const c = capacity();
    expect(c.active).toBe(12);
    expect(c.committed).toHaveLength(6);
    expect(c.overCapacityBy).toBe(0);
    // Leif has now stated all eighteen, so nothing in the forecast rests
    // on a date inferred from a booking.
    expect(c.unconfirmedStartWeek).toHaveLength(0);
    expect(c.unknownEnd).toHaveLength(0);
  });

  test("a projection that has run out does not end anybody", () => {
    // Jules started on 20 May. Four months lands on 20 September, which
    // was yesterday, and Leif still considers him a current client.
    // Arithmetic is not an event: he keeps his slot until a real end
    // date or a terminal status says otherwise, and he is named so the
    // question reaches Leif instead of silently freeing a slot.
    const c = capacity();
    expect(c.endProjectionOverdue.map((h) => h.name)).toEqual([
      "Jules Litman-Cleper",
    ]);
    expect(c.active).toBe(12);

    const { ledger } = computeFutureOpenings(c, NOW);
    expect(
      ledger.some((entry) => entry.holder.name === "Jules Litman-Cleper"),
    ).toBe(false);
  });

  test("the event-by-event ledger, today through 31 January", () => {
    const { ledger } = computeFutureOpenings(capacity(), NOW);

    const throughJanuary = ledger
      .filter((entry) => entry.date <= "2027-01-31")
      .map((entry) => [
        entry.date,
        entry.holder.name,
        entry.kind,
        entry.occupiedAfter,
        entry.remainingAfter,
        entry.overCapacityAfter,
      ]);

    expect(throughJanuary).toEqual([
      // Two arrive in the first week of October. Nobody has left.
      ["2026-10-05", "Ava Frotton", "start", 13, 0, 1],
      ["2026-10-05", "Denise Cormier", "start", 14, 0, 2],
      // The June starters finish.
      ["2026-10-14", "Adriano Castro", "end", 13, 0, 1],
      ["2026-10-14", "Jess Beauchamp", "end", 12, 0, 0],
      // Four on one day — the peak of the whole picture, and four over.
      ["2026-11-08", "Daniel Alexander", "start", 13, 0, 1],
      ["2026-11-08", "Emma Wijns", "start", 14, 0, 2],
      ["2026-11-08", "Heidi Elias", "start", 15, 0, 3],
      ["2026-11-08", "Linda Turner", "start", 16, 0, 4],
      // The four who started together on 20 July finish together.
      ["2026-11-20", "Emily Loeb", "end", 15, 0, 3],
      ["2026-11-20", "Gigi George", "end", 14, 0, 2],
      ["2026-11-20", "Mia Cosme", "end", 13, 0, 1],
      ["2026-11-20", "Morgan Schenkeveld", "end", 12, 0, 0],
      ["2026-12-03", "Mackenzie Stabler", "end", 11, 1, 0],
      ["2026-12-17", "Erik Amundson", "end", 10, 2, 0],
      ["2026-12-17", "Sarah Monast", "end", 9, 3, 0],
      ["2027-01-10", "Pete Bassett", "end", 8, 4, 0],
      ["2027-01-16", "Gina McNamara", "end", 7, 5, 0],
    ]);
  });

  test("a committed client gives their slot back when they finish", () => {
    // The bug this test exists for: the first ledger only scanned
    // currently-occupied containers for end dates, so a future start was
    // a permanent +1 and every month after it came out one short.
    const { ledger } = computeFutureOpenings(capacity(), NOW);
    const denise = ledger.filter(
      (entry) => entry.holder.name === "Denise Cormier",
    );
    expect(denise.map((entry) => [entry.date, entry.kind])).toEqual([
      ["2026-10-05", "start"],
      ["2027-02-05", "end"],
    ]);
  });

  test("no opening until January, and January is three", () => {
    // Two containers finish in October and four in November, and neither
    // month is an opening: sixteen people are in the programme on 8
    // November, so anybody started before then would have been the
    // seventeenth. December is not one either — occupancy is still at
    // twelve on the 1st.
    const { months } = computeFutureOpenings(capacity(), NOW);
    const byMonth = Object.fromEntries(months.map((m) => [m.month, m]));

    expect(byMonth["2026-10"]!.openings).toBe(0);
    expect(byMonth["2026-11"]!.openings).toBe(0);
    expect(byMonth["2026-12"]!.openings).toBe(0);
    expect(byMonth["2027-01"]!.openings).toBe(3);

    // And the reason is on the row, not buried in the arithmetic.
    expect(byMonth["2026-11"]!.peakOccupancy).toBe(16);
    expect(byMonth["2026-11"]!.overCapacityBy).toBe(4);
  });

  test("nothing can be started today either", () => {
    const c = capacity();
    expect(c.openings).toBe(0);
    // Not an over-capacity practice — a full one, with a November that
    // has to be got through.
    expect(c.active).toBe(12);
    expect(c.overCapacityBy).toBe(0);
  });

  test("Jules is the difference between no December opening and one", () => {
    // The single most valuable thing on the board for Leif right now.
    // Jules holds a slot indefinitely because his projection ran out and
    // nobody has recorded a real end. Give him one and December opens.
    const withJulesEnded = population.map((enrollment) =>
      enrollment.name === "Jules Litman-Cleper"
        ? {
            ...enrollment,
            end_date: "2026-09-20",
            status: "completed" as const,
          }
        : enrollment,
    );
    const after = computeFutureOpenings(
      computeIndividualCapacity(withJulesEnded, MAX, FOUR_MONTHS, NOW),
      NOW,
    );
    expect(after.months.find((m) => m.month === "2026-12")!.openings).toBe(1);
  });

  test("the four imported dates that were wrong each moved a real slot", () => {
    // What the forecast would have said on the values the CRM inferred
    // from first bookings. Not a hypothetical: this is what would have
    // shipped.
    const imported: Record<string, string> = {
      "Jules Litman-Cleper": "2026-06-24",
      "Gigi George": "2026-07-19",
      "Mackenzie Stabler": "2026-07-29",
      "Denise Cormier": "2026-09-30",
    };
    const asImported = population.map((enrollment) =>
      imported[enrollment.name!]
        ? { ...enrollment, start_date: imported[enrollment.name!]! }
        : enrollment,
    );
    const before = computeFutureOpenings(
      computeIndividualCapacity(asImported, MAX, FOUR_MONTHS, NOW),
      NOW,
    );
    const beforeByMonth = Object.fromEntries(
      before.months.map((m) => [m.month, m.openings]),
    );
    // It would have promised two openings in December that do not exist,
    // and invented an over-committed September that never happened.
    expect(beforeByMonth["2026-12"]).toBe(2);
    expect(
      before.months.find((m) => m.month === "2026-09")?.overCapacityBy,
    ).toBe(1);

    const now = computeFutureOpenings(capacity(), NOW);
    expect(now.months.find((m) => m.month === "2026-12")!.openings).toBe(0);
    expect(now.months.find((m) => m.month === "2026-09")).toBeUndefined();
  });
});
