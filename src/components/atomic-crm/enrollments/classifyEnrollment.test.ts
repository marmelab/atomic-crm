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

// Adriano Castro disappeared from Living Example → Current while he was
// still a current client with two sessions left. The rule below was never
// wrong; his Enrollment had been stamped 'completed' by the historical
// import on the day his Opportunity was created, and 76 sessions across 12
// clients had been stamped 'completed' while scheduled in the future.
//
// The data is repaired and the database now refuses both (see
// 20260918260000_a_session_in_the_future_has_not_happened.sql). These
// cases hold the classification end of it: a client who has started and
// not finished is Current, and only a terminal status takes him out.
describe("a client who has started and not finished stays Current", () => {
  test("an active enrollment that began months ago is current, not past", () => {
    // Arrange — Adriano: started 2026-06-14, sessions still to come.
    const enrollment = {
      status: "active" as const,
      start_date: "2026-06-14",
      end_date: null,
    };

    // Act
    const phase = classifyEnrollment(enrollment, "2026-09-18");

    // Assert
    expect(phase).toBe("current");
  });

  test("no end date does not make a started client past", () => {
    // Arrange — his Enrollment carries no end_date at all, which must
    // never be read as "finished".
    const enrollment = {
      status: "active" as const,
      start_date: "2026-06-14",
      end_date: null,
    };

    // Act & Assert
    expect(classifyEnrollment(enrollment, "2027-01-01")).toBe("current");
  });

  test("only a terminal status removes a started client from Current", () => {
    // Arrange — the single thing that moved him, and the reason the fix
    // belongs in the data rather than here.
    const base = { start_date: "2026-06-14", end_date: null };

    // Act & Assert
    expect(
      classifyEnrollment({ ...base, status: "active" as const }, "2026-09-18"),
    ).toBe("current");
    expect(
      classifyEnrollment(
        { ...base, status: "completed" as const },
        "2026-09-18",
      ),
    ).toBe("past");
  });
});
