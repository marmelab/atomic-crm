import { describe, expect, it } from "vitest";

import {
  byNewestStartFirst,
  bySoonestStartFirst,
  classifyEnrollment,
} from "./classifyEnrollment";
import type { Enrollment } from "../types";

// Daniel Alexander appeared under Current Clients with a container that
// starts on 8 November — seven weeks away — because "status is active" was
// the entire classification. Leif cannot plan around a Current list that
// includes people he has not started working with.
const TODAY = "2026-09-18";

const enrollment = (over: Partial<Enrollment>): Enrollment =>
  ({
    id: 1,
    opportunity_id: 1,
    status: "active",
    start_date: null,
    end_date: null,
    created_at: "2026-01-01T00:00:00.000Z",
    updated_at: "2026-01-01T00:00:00.000Z",
    ...over,
  }) as Enrollment;

describe("which clients are current", () => {
  it("treats an active enrollment that has not started yet as upcoming", () => {
    // Daniel's exact production shape.
    expect(
      classifyEnrollment(
        enrollment({ status: "active", start_date: "2026-11-08" }),
        TODAY,
      ),
    ).toBe("upcoming");
  });

  it("treats an active enrollment that has started as current", () => {
    expect(
      classifyEnrollment(
        enrollment({ status: "active", start_date: "2026-09-10" }),
        TODAY,
      ),
    ).toBe("current");
  });

  it("counts a container starting today as current, not upcoming", () => {
    expect(
      classifyEnrollment(
        enrollment({ status: "active", start_date: TODAY }),
        TODAY,
      ),
    ).toBe("current");
  });

  it.each(["completed", "withdrawn", "ended"] as const)(
    "treats %s as past whatever the dates say",
    (status) => {
      expect(
        classifyEnrollment(
          enrollment({ status, start_date: "2026-01-01", end_date: null }),
          TODAY,
        ),
      ).toBe("past");
    },
  );

  it("treats a container whose end date has passed as past even if nobody closed it", () => {
    expect(
      classifyEnrollment(
        enrollment({
          status: "active",
          start_date: "2026-01-01",
          end_date: "2026-08-24",
        }),
        TODAY,
      ),
    ).toBe("past");
  });

  it("treats onboarding with a future start as upcoming, not current", () => {
    // Agreeing terms is real work, but it is not the programme running.
    expect(
      classifyEnrollment(
        enrollment({ status: "onboarding", start_date: "2027-01-05" }),
        TODAY,
      ),
    ).toBe("upcoming");
  });

  it("keeps an enrollment with no start date visible as current rather than hiding it", () => {
    // It is live work whose date was never recorded; the row says so.
    expect(
      classifyEnrollment(
        enrollment({ status: "active", start_date: null }),
        TODAY,
      ),
    ).toBe("current");
  });
});

describe("ordering", () => {
  it("puts the newest-starting current client at the top", () => {
    const rows = [
      enrollment({ id: 1, start_date: "2026-06-24" }),
      enrollment({ id: 2, start_date: "2026-09-16" }),
      enrollment({ id: 3, start_date: "2026-07-20" }),
    ];

    expect([...rows].sort(byNewestStartFirst).map((e) => Number(e.id))).toEqual(
      [2, 3, 1],
    );
  });

  it("puts the soonest-starting upcoming client at the top", () => {
    const rows = [
      enrollment({ id: 1, start_date: "2027-01-05" }),
      enrollment({ id: 2, start_date: "2026-11-08" }),
    ];

    expect(
      [...rows].sort(bySoonestStartFirst).map((e) => Number(e.id)),
    ).toEqual([2, 1]);
  });

  it("sorts an unknown start date last rather than treating it as ancient", () => {
    const rows = [
      enrollment({ id: 1, start_date: null }),
      enrollment({ id: 2, start_date: "2026-01-01" }),
    ];

    expect([...rows].sort(byNewestStartFirst).map((e) => Number(e.id))).toEqual(
      [2, 1],
    );
  });

  it("breaks a same-date tie deterministically", () => {
    const rows = [
      enrollment({ id: 5, start_date: "2026-07-20" }),
      enrollment({ id: 9, start_date: "2026-07-20" }),
    ];

    expect([...rows].sort(byNewestStartFirst).map((e) => Number(e.id))).toEqual(
      [9, 5],
    );
    expect(
      [...rows]
        .reverse()
        .sort(byNewestStartFirst)
        .map((e) => Number(e.id)),
    ).toEqual([9, 5]);
  });
});
