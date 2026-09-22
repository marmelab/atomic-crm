import { describe, expect, test } from "vitest";

import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "./individualCapacity";
import { computeExpectedEnd, type SessionWeek } from "./sessionWeeks";

// The Living Example, as it really stands on 21 September 2026.
//
// A golden scenario, not an illustration. The calendar below is Leif's own
// Year Tracking `1:1s` weeks as production holds them, and the Start Dates
// are the eighteen he has stated. The assertions are the exact occupancy at
// every boundary. If the engine ever drifts, this is the file that says so
// in terms Leif can check by eye.
//
// It exists because the first version of this maths produced four numbers
// that could not all be true at once, and nothing in the suite noticed.

const NOW = new Date("2026-09-21T12:00:00Z");
const MAX = 12;

// Every live `1:1s` window on the Year Tracking calendar, from production.
// Note the gap: there is no eligible week at all between 2 July and 13
// September 2026, and the calendar stops on 24 January 2027.
const CALENDAR: SessionWeek[] = [
  ["2025-09-07", "2025-09-11"],
  ["2025-09-21", "2025-09-25"],
  ["2025-10-05", "2025-10-09"],
  ["2025-10-19", "2025-10-23"],
  ["2025-11-02", "2025-11-06"],
  ["2025-11-09", "2025-11-13"],
  ["2025-11-30", "2025-12-04"],
  ["2025-12-14", "2025-12-18"],
  ["2026-01-11", "2026-01-15"],
  ["2026-01-18", "2026-01-22"],
  ["2026-02-08", "2026-02-12"],
  ["2026-02-15", "2026-02-19"],
  ["2026-03-08", "2026-03-12"],
  ["2026-03-22", "2026-03-26"],
  ["2026-03-29", "2026-04-02"],
  ["2026-04-12", "2026-04-16"],
  ["2026-04-19", "2026-04-23"],
  ["2026-04-26", "2026-04-30"],
  ["2026-04-29", "2026-04-30"],
  ["2026-05-03", "2026-05-07"],
  ["2026-05-10", "2026-05-14"],
  ["2026-05-17", "2026-05-21"],
  ["2026-06-14", "2026-06-18"],
  ["2026-06-21", "2026-06-25"],
  ["2026-06-28", "2026-07-02"],
  ["2026-09-13", "2026-09-17"],
  ["2026-09-20", "2026-09-24"],
  ["2026-09-27", "2026-10-01"],
  ["2026-10-04", "2026-10-08"],
  ["2026-10-11", "2026-10-15"],
  ["2026-10-18", "2026-10-22"],
  ["2026-11-08", "2026-11-12"],
  ["2026-11-15", "2026-11-19"],
  ["2026-11-29", "2026-12-03"],
  ["2026-12-06", "2026-12-10"],
  ["2026-12-13", "2026-12-17"],
  ["2027-01-03", "2027-01-07"],
  ["2027-01-10", "2027-01-14"],
  ["2027-01-24", "2027-01-28"],
].map(([start, end]) => ({ start: start!, end: end!, title: "1:1s" }));

// The twelve Leif is working with, and the six who have agreed to start.
// Every Start Date is owner-stated.
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
const COMMITTED: [string, string][] = [
  ["2026-10-05", "Ava Frotton"],
  ["2026-10-05", "Denise Cormier"],
  ["2026-11-08", "Daniel Alexander"],
  ["2026-11-08", "Emma Wijns"],
  ["2026-11-08", "Heidi Elias"],
  ["2026-11-08", "Linda Turner"],
];

// The two cadence issues on record are both `known_skip` — Jules and
// Pete. Neither extends a container.
const CLASSIFICATIONS: Record<string, string[]> = {
  "Jules Litman-Cleper": ["known_skip"],
  "Pete Bassett": ["known_skip"],
};

const population: SlotEnrollment[] = [...OCCUPIED, ...COMMITTED].map(
  ([start, name], i) => ({
    id: i + 1,
    status: "active" as const,
    start_date: start,
    end_date: null,
    start_date_source: "owner" as const,
    name,
    contactId: i + 1,
    cadenceClassifications: CLASSIFICATIONS[name] ?? [],
  }),
);

const capacity = () =>
  computeIndividualCapacity(population, MAX, CALENDAR, NOW);

describe("the real Living Example, 21 September 2026", () => {
  test("twelve active, six committed, every Start Week owner-stated", () => {
    const c = capacity();
    expect(c.active).toBe(12);
    expect(c.committed).toHaveLength(6);
    expect(c.overCapacityBy).toBe(0);
    expect(c.unconfirmedStartWeek).toHaveLength(0);
  });

  test("Jules is a current client, and the calendar says so", () => {
    // The acceptance case. Four calendar months from 20 May lands on 20
    // September — the old model had already ended him. His twelve
    // eligible `1:1s` weeks run to the week of 15 November, because there
    // is no eligible week at all between 2 July and 13 September.
    //
    // Nothing about him is special-cased: this is the general rule
    // applied to his own Start Date.
    const end = computeExpectedEnd(CALENDAR, "2026-05-20", 0)!;
    expect(end.status).toBe("known");
    if (end.status !== "known") throw new Error("unreachable");
    // His Start Date falls inside the week of 17 May, which is Session
    // Week #1 — not the next week after it.
    expect(end.finalWeek.start).toBe("2026-11-15");
    expect(end.freesOn).toBe("2026-11-19");
    // His recorded cadence issue is a known skip, which forfeits the
    // session and extends nothing.
    expect(end.extensions).toBe(0);
  });

  test("every current client's final session week", () => {
    const byName = Object.fromEntries(
      capacity().occupied.map((holder) => [
        holder.name,
        holder.end?.status === "known"
          ? holder.end.finalWeek.start
          : holder.end?.status,
      ]),
    );
    expect(byName).toEqual({
      "Jules Litman-Cleper": "2026-11-15",
      "Adriano Castro": "2026-11-29",
      "Jess Beauchamp": "2026-11-29",
      "Emily Loeb": "2027-01-03",
      "Gigi George": "2027-01-03",
      "Mia Cosme": "2027-01-03",
      "Morgan Schenkeveld": "2027-01-03",
      "Mackenzie Stabler": "2027-01-03",
      "Erik Amundson": "2027-01-03",
      "Sarah Monast": "2027-01-03",
      "Pete Bassett": "2027-01-03",
      "Gina McNamara": "2027-01-03",
    });
  });

  test("not one committed client's end can be worked out yet", () => {
    // Year Tracking stops on 24 January 2027. None of the six reaches a
    // twelfth eligible week inside it, so none of them has an end — and
    // an unknown end holds its slot for the whole horizon.
    const c = capacity();
    expect(c.needsCalendar.map((h) => h.name).sort()).toEqual(
      COMMITTED.map(([, name]) => name).sort(),
    );
    const ava = c.committed.find((h) => h.name === "Ava Frotton")!;
    expect(ava.end).toMatchObject({
      status: "incomplete",
      weeksScheduled: 11,
      weeksRequired: 12,
    });
    const daniel = c.committed.find((h) => h.name === "Daniel Alexander")!;
    expect(daniel.end).toMatchObject({
      status: "incomplete",
      weeksScheduled: 8,
      weeksRequired: 12,
    });
    expect(c.calendarHorizon).toBe("2027-01-28");
  });

  test("the event-by-event ledger, today onward", () => {
    const { ledger } = computeFutureOpenings(capacity(), NOW);

    expect(
      ledger.map((entry) => [
        entry.date,
        entry.holder.name,
        entry.kind,
        entry.occupiedAfter,
        entry.overCapacityAfter,
      ]),
    ).toEqual([
      // The six arrive; nobody has left yet.
      ["2026-10-05", "Ava Frotton", "start", 13, 1],
      ["2026-10-05", "Denise Cormier", "start", 14, 2],
      ["2026-11-08", "Daniel Alexander", "start", 15, 3],
      ["2026-11-08", "Emma Wijns", "start", 16, 4],
      ["2026-11-08", "Heidi Elias", "start", 17, 5],
      ["2026-11-08", "Linda Turner", "start", 18, 6],
      // Then the current containers finish.
      ["2026-11-19", "Jules Litman-Cleper", "end", 17, 5],
      ["2026-12-03", "Adriano Castro", "end", 16, 4],
      ["2026-12-03", "Jess Beauchamp", "end", 15, 3],
      ["2027-01-07", "Emily Loeb", "end", 14, 2],
      ["2027-01-07", "Erik Amundson", "end", 13, 1],
      ["2027-01-07", "Gigi George", "end", 12, 0],
      ["2027-01-07", "Gina McNamara", "end", 11, 0],
      ["2027-01-07", "Mackenzie Stabler", "end", 10, 0],
      ["2027-01-07", "Mia Cosme", "end", 9, 0],
      ["2027-01-07", "Morgan Schenkeveld", "end", 8, 0],
      ["2027-01-07", "Pete Bassett", "end", 7, 0],
      ["2027-01-07", "Sarah Monast", "end", 6, 0],
    ]);
  });

  test("eighteen people in the programme on 8 November", () => {
    // Six over the ceiling, on owner-stated Start Dates. Not a modelling
    // artefact and not something the CRM may round away.
    const { ledger } = computeFutureOpenings(capacity(), NOW);
    const peak = Math.max(...ledger.map((entry) => entry.occupiedAfter));
    expect(peak).toBe(18);
  });

  test("no opening can be offered at all, and the reason is the calendar", () => {
    // Both halves fail. There is no headroom until well into 2027, and a
    // new client starting today has nowhere to put sessions 4 through 12
    // — Year Tracking only reaches 24 January.
    const c = capacity();

    // Somebody starting TODAY could be scheduled — thirteen eligible
    // weeks remain, so their twelve exist. There is simply no room:
    // eighteen people are in the programme on 8 November.
    expect(c.openings).toEqual({
      status: "known",
      openings: 0,
      peakOccupancy: 18,
    });

    // Every month after that fails the OTHER half. A client starting in
    // October has only eleven eligible weeks left in the calendar, in
    // November eight, in December five. Not "no openings" — not knowable,
    // and the board says which.
    const { months } = computeFutureOpenings(c, NOW);
    expect(
      months.map((month) => [
        month.month,
        month.openings.status === "unknown"
          ? month.openings.weeksScheduled
          : "known",
      ]),
    ).toEqual([
      ["2026-10", 11],
      ["2026-11", 8],
      // Five, counted from the week of 6 December — the first `1:1s` week
      // that actually begins in December.
      //
      // This used to be six, because a month was evaluated from its 1st
      // and the week of 29 November runs to 3 December, so it was still
      // "eligible for a client starting on the 1st". But somebody who
      // starts in the week of 29 November starts in NOVEMBER; counting
      // their week towards a December start was an artefact of picking a
      // candidate date that is not a session week at all. Months are now
      // answered from the weeks that begin in them.
      ["2026-12", 5],
      ["2027-01", 3],
    ]);
  });

  test("extending Year Tracking is what changes the answer", () => {
    // Twelve more weekly `1:1s` weeks after the current horizon. The six
    // committed containers gain ends, and the board can finally speak.
    const extended = [...CALENDAR];
    const cursor = new Date("2027-01-31T00:00:00Z");
    for (let i = 0; i < 16; i++) {
      const start = cursor.toISOString().slice(0, 10);
      const end = new Date(`${start}T00:00:00Z`);
      end.setUTCDate(end.getUTCDate() + 5);
      extended.push({
        start,
        end: end.toISOString().slice(0, 10),
        title: "1:1s",
      });
      cursor.setUTCDate(cursor.getUTCDate() + 7);
    }

    const c = computeIndividualCapacity(population, MAX, extended, NOW);
    expect(c.needsCalendar).toHaveLength(0);
    expect(c.openings).toMatchObject({ status: "known" });

    // And with every end known, the ledger finds real openings.
    const { months } = computeFutureOpenings(c, NOW);
    const firstOpen = months.find(
      (month) =>
        month.openings.status === "known" && month.openings.openings > 0,
    );
    // January, and specifically the week of the 10th.
    //
    // This read February while a month was answered only from its 1st:
    // on 1 January the practice is still full, so January looked closed
    // and the first sellable week inside it was invisible. The board now
    // names the week, which is what Leif can actually offer somebody.
    expect(firstOpen?.month).toBe("2027-01");
    expect(firstOpen?.earliestSafeStart?.start).toBe("2027-01-10");
  });
});
