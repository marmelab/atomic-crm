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

  test("under capacity reports the difference", () => {
    const capacity = computeIndividualCapacity(
      Array.from({ length: 9 }, () => started()),
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.openings).toBe(3);
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
    expect(october.netAvailableAfter).toBe(0);
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
    expect(october.netAvailableAfter).toBe(-2);
    // January: the twelve started in September finish, netting back up.
    const january = months.find((month) => month.month === "2027-01")!;
    expect(january.netAvailableAfter).toBe(10);
  });

  test("the running total starts from the openings available today", () => {
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
    // Ten free now, one more frees in October.
    expect(months[0]!.netAvailableAfter).toBe(11);
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

describe("the real Living Example population, as it stood on 2026-09-21", () => {
  // The eighteen rows the dashboard was adding up. Start dates are the
  // real ones; names are the real clients'. This is the regression test
  // for the number Leif actually saw.
  const REAL_STARTS_OCCUPIED = [
    "2026-06-14",
    "2026-06-14",
    "2026-06-24",
    "2026-07-19",
    "2026-07-20",
    "2026-07-20",
    "2026-07-20",
    "2026-07-29",
    "2026-08-17",
    "2026-08-17",
    "2026-09-10",
    "2026-09-16",
  ];
  const REAL_STARTS_COMMITTED = [
    "2026-09-30",
    "2026-10-05",
    "2026-11-08",
    "2026-11-08",
    "2026-11-08",
    "2026-11-08",
  ];

  const population = [...REAL_STARTS_OCCUPIED, ...REAL_STARTS_COMMITTED].map(
    (start_date) => enrollment({ status: "active", start_date }),
  );

  test("reports twelve active, not eighteen", () => {
    const capacity = computeIndividualCapacity(
      population,
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    expect(capacity.active).toBe(12);
    expect(capacity.committed).toHaveLength(6);
    expect(capacity.openings).toBe(0);
    expect(capacity.overCapacityBy).toBe(0);
  });

  test("shows the practice as over-committed before it shows an opening", () => {
    // September is the month that matters: nobody finishes, and somebody
    // is already booked to start on the 30th. The practice is a person
    // over its ceiling before a single slot frees, which is precisely
    // what "0 openings" on the old card could never have said.
    const capacity = computeIndividualCapacity(
      population,
      MAX,
      FOUR_MONTHS,
      NOW,
    );
    const { months } = computeFutureOpenings(capacity, NOW);
    const byMonth = Object.fromEntries(
      months.map((month) => [month.month, month.netAvailableAfter]),
    );

    expect(byMonth["2026-09"]).toBe(-1);
    expect(byMonth["2026-10"]).toBe(1);
    expect(byMonth["2026-11"]).toBe(2);
    expect(byMonth["2026-12"]).toBe(4);
    expect(byMonth["2027-01"]).toBe(6);
  });
});
