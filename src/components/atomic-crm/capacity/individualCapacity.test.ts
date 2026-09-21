import { describe, expect, test } from "vitest";

import {
  computeFutureOpenings,
  computeIndividualCapacity,
  type SlotEnrollment,
} from "./individualCapacity";

// 2026-09-21 — the day the Living Example capacity numbers were audited.
const NOW = new Date("2026-09-21T12:00:00Z");
const MAX = 12;
const FOUR_MONTHS = 4;

let nextId = 1;
const enrollment = (
  overrides: Partial<SlotEnrollment> = {},
): SlotEnrollment => ({
  id: nextId++,
  status: "active",
  start_date: "2026-06-01",
  end_date: null,
  name: `Client ${nextId}`,
  contactId: nextId,
  ...overrides,
});

const started = (overrides: Partial<SlotEnrollment> = {}) =>
  enrollment({ start_date: "2026-06-01", ...overrides });

describe("which Enrollments consume a Living Example slot", () => {
  test("a container that has started and not finished consumes one", () => {
    const capacity = computeIndividualCapacity(
      [started({ status: "active" })],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(1);
    expect(capacity.openings).toBe(11);
  });

  test("onboarding and offboarding consume one too — the programme is running", () => {
    const capacity = computeIndividualCapacity(
      [
        started({ status: "onboarding" }),
        started({ status: "active" }),
        started({ status: "offboarding" }),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(3);
  });

  test.each(["completed", "withdrawn", "ended"] as const)(
    "a %s container consumes nothing — it has released its slot",
    (status) => {
      const capacity = computeIndividualCapacity(
        [started({ status }), started({ status: "active" })],
        MAX,
        FOUR_MONTHS,
        NOW,
      );
      expect(capacity.active).toBe(1);
    },
  );

  test("an agreed container that has not started yet is committed, NOT active", () => {
    // The whole bug. Six people had agreed to start in October and
    // November; the dashboard added them to the twelve people Leif was
    // actually working with and reported "18 / 12 active".
    const capacity = computeIndividualCapacity(
      [
        ...Array.from({ length: 12 }, () => started({ status: "active" })),
        ...Array.from({ length: 6 }, () =>
          enrollment({ status: "active", start_date: "2026-11-08" }),
        ),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(12);
    expect(capacity.committed).toHaveLength(6);
    expect(capacity.openings).toBe(0);
    expect(capacity.overCapacityBy).toBe(0);
  });

  test("a container starting TODAY is active, not committed", () => {
    const capacity = computeIndividualCapacity(
      [enrollment({ start_date: "2026-09-21" })],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(1);
    expect(capacity.committed).toHaveLength(0);
  });

  test("a container whose recorded end has passed consumes nothing, whatever its status says", () => {
    const capacity = computeIndividualCapacity(
      [enrollment({ status: "active", end_date: "2026-08-24" })],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(0);
  });

  test("a live container with no start date recorded still counts — it is not hidden", () => {
    // A real person Leif is working with, whose date nobody wrote down.
    // Filing them as "upcoming" or dropping them would undercount the
    // practice.
    const capacity = computeIndividualCapacity(
      [enrollment({ status: "active", start_date: null })],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(1);
    expect(capacity.unknownEnd).toHaveLength(1);
  });
});

describe("openings", () => {
  test("no clients means every slot is open", () => {
    const capacity = computeIndividualCapacity([], MAX, FOUR_MONTHS, NOW);
    expect(capacity.active).toBe(0);
    expect(capacity.openings).toBe(12);
    expect(capacity.overCapacityBy).toBe(0);
  });

  test("exactly twelve active means zero openings", () => {
    const capacity = computeIndividualCapacity(
      Array.from({ length: 12 }, () => started()),
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.openings).toBe(0);
    expect(capacity.overCapacityBy).toBe(0);
  });

  test("under capacity, with nothing booked, openings is the plain difference", () => {
    const capacity = computeIndividualCapacity(
      Array.from({ length: 9 }, () => started()),
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.openings).toBe(3);
  });

  test("a committed future start is subtracted from today's openings", () => {
    // The failure this prevents: nine in the programme, three slots
    // apparently free, and four people already booked to arrive next
    // month. "3 openings" would be an invitation to overbook by one.
    const capacity = computeIndividualCapacity(
      [
        // Still in the programme in October, so the two groups overlap —
        // with a 1 June start they would all have finished twelve days
        // before the arrivals, and three openings would be correct.
        ...Array.from({ length: 9 }, () =>
          started({ start_date: "2026-09-01" }),
        ),
        ...Array.from({ length: 4 }, () =>
          enrollment({ start_date: "2026-10-12" }),
        ),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(9);
    expect(capacity.committed).toHaveLength(4);
    expect(capacity.openings).toBe(0);
  });

  test("over capacity never reports negative openings — it reports being over", () => {
    // Malformed or over-capacity data is a real condition. Clamping it to
    // "0 openings" reads as a full practice; the number is what makes it
    // legible.
    const capacity = computeIndividualCapacity(
      Array.from({ length: 14 }, () => started()),
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.openings).toBe(0);
    expect(capacity.openings).not.toBeLessThan(0);
    expect(capacity.overCapacityBy).toBe(2);
  });

  test("openings is unknown, not zero, when the Offer has no ceiling", () => {
    const capacity = computeIndividualCapacity(
      [started()],
      null,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.openings).toBeNull();
    expect(capacity.active).toBe(1);
  });
});

describe("future openings", () => {
  test("groups projected finishes by month, soonest first", () => {
    const capacity = computeIndividualCapacity(
      [
        started({ start_date: "2026-06-14", name: "Adriano" }),
        started({ start_date: "2026-06-14", name: "Jess" }),
        started({ start_date: "2026-08-17", name: "Sarah" }),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);

    expect(months.map((month) => month.month)).toEqual(["2026-10", "2026-12"]);
    expect(months[0]!.freeing.map((holder) => holder.name)).toEqual([
      "Adriano",
      "Jess",
    ]);
  });

  test("an already-booked start cancels out the opening it fills", () => {
    // Two clients finish in October and two others are already booked to
    // start in October. Announcing "2 openings in October" would invite
    // Leif to sell a slot he has already sold.
    const capacity = computeIndividualCapacity(
      [
        started({ start_date: "2026-06-14" }),
        started({ start_date: "2026-06-20" }),
        ...Array.from({ length: 10 }, () =>
          started({ start_date: "2026-09-01" }),
        ),
        enrollment({ start_date: "2026-10-05", name: "Ava" }),
        enrollment({ start_date: "2026-10-06", name: "Denise" }),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);

    const october = months.find((month) => month.month === "2026-10")!;
    expect(october.freeing).toHaveLength(2);
    expect(october.committing).toHaveLength(2);
    expect(october.openings).toBe(0);
  });

  test("more booked starts than departures shows as over-commitment, and carries forward", () => {
    const capacity = computeIndividualCapacity(
      [
        ...Array.from({ length: 12 }, () =>
          started({ start_date: "2026-09-01" }),
        ),
        enrollment({ start_date: "2026-10-05" }),
        enrollment({ start_date: "2026-10-06" }),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);

    const october = months.find((month) => month.month === "2026-10")!;
    // Fourteen people in a practice that holds twelve.
    expect(october.peakOccupancy).toBe(14);
    expect(october.overCapacityBy).toBe(2);
    expect(october.openings).toBe(0);
    // January: the twelve started in September have finished, and the
    // two October arrivals are still in. Ten free, and a new client
    // starting in January would not breach the ceiling at any point
    // during their own four months.
    const january = months.find((month) => month.month === "2027-01")!;
    expect(january.openings).toBe(10);
  });

  test("a month's answer accounts for everyone already in the programme", () => {
    const capacity = computeIndividualCapacity(
      [
        started({ start_date: "2026-06-14" }),
        started({ start_date: "2026-09-01" }),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);
    // Two in the programme and nobody booked to arrive, so ten could
    // start today. October is also ten, not eleven: a client starting on
    // the 1st overlaps BOTH of them, and the one finishing on the 14th
    // frees their slot too late to help. The month is answered from the
    // day somebody could actually begin, never from its best moment.
    expect(capacity.openings).toBe(10);
    expect(months[0]!.month).toBe("2026-10");
    expect(months[0]!.openings).toBe(10);
  });

  test("a recorded end date wins over the four-month projection", () => {
    const capacity = computeIndividualCapacity(
      [started({ start_date: "2026-06-14", end_date: "2026-12-31" })],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);
    expect(months.map((month) => month.month)).toEqual(["2026-12"]);
    expect(capacity.occupied[0]!.end.basis).toBe("recorded");
  });

  test("a client with no computable end is excluded and named, not silently dropped", () => {
    const capacity = computeIndividualCapacity(
      [
        started({ start_date: "2026-06-14", name: "Adriano" }),
        enrollment({ start_date: null, name: "Nobody wrote it down" }),
      ],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months, unknownEnd } = computeFutureOpenings(capacity, NOW);

    expect(months).toHaveLength(1);
    expect(unknownEnd.map((holder) => holder.name)).toEqual([
      "Nobody wrote it down",
    ]);
  });

  test("an Offer with no recorded length projects nothing, rather than guessing", () => {
    const capacity = computeIndividualCapacity(
      [started({ start_date: "2026-06-14" })],
      MAX,
      null,
      NOW,
    );
    const { months, unknownEnd } = computeFutureOpenings(capacity, NOW);
    expect(months).toHaveLength(0);
    expect(unknownEnd).toHaveLength(1);
  });

  test("a projected end already in the past frees nothing in the future", () => {
    const capacity = computeIndividualCapacity(
      [started({ start_date: "2026-01-01" })],
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);
    expect(months).toHaveLength(0);
  });

  test("months are ordered deterministically regardless of input order", () => {
    const inputs = [
      started({ start_date: "2026-08-17" }),
      started({ start_date: "2026-06-14" }),
      started({ start_date: "2026-07-20" }),
    ];
    const forwards = computeFutureOpenings(
      computeIndividualCapacity(inputs, MAX, FOUR_MONTHS, NOW),
      NOW,
    );
    const backwards = computeFutureOpenings(
      computeIndividualCapacity([...inputs].reverse(), MAX, FOUR_MONTHS, NOW),
      NOW,
    );
    expect(forwards.months.map((month) => month.month)).toEqual(
      backwards.months.map((month) => month.month),
    );
    expect(forwards.months.map((month) => month.month)).toEqual([
      "2026-10",
      "2026-11",
      "2026-12",
    ]);
  });

  test("no ceiling means no future-openings projection at all", () => {
    const capacity = computeIndividualCapacity(
      [started({ start_date: "2026-06-14" })],
      null,
      FOUR_MONTHS,
      NOW,
    );
    expect(computeFutureOpenings(capacity, NOW).months).toHaveLength(0);
  });
});
