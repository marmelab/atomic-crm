import { describe, expect, it } from "vitest";

import type { Deal } from "../types";
import { getDealsByStage } from "./stages";

// Kanban queue-ordering slice: getDealsByStage now sorts each column by
// stage_entered_at ascending (oldest/longest-in-stage first) instead of
// the old manual `index` field.
const dealStages = [
  { value: "interested", label: "Interested" },
  { value: "call_booked", label: "Call Booked" },
];

const buildDeal = (overrides: Partial<Deal> & Pick<Deal, "id">): Deal => ({
  pricing_mode: "standard",
  name: "Test — The Living Example",
  contact_id: 1,
  offer_id: 1,
  stage: "interested",
  amount: 4000,
  created_at: "2026-01-01T00:00:00.000Z",
  updated_at: "2026-01-01T00:00:00.000Z",
  sales_id: 0,
  index: 0,
  stage_entered_at: "2026-01-01T00:00:00.000Z",
  ...overrides,
});

describe("getDealsByStage", () => {
  it("sorts a column oldest stage_entered_at first, newest last", () => {
    const newest = buildDeal({
      id: 1,
      stage_entered_at: "2026-06-03T00:00:00.000Z",
    });
    const oldest = buildDeal({
      id: 2,
      stage_entered_at: "2026-06-01T00:00:00.000Z",
    });
    const middle = buildDeal({
      id: 3,
      stage_entered_at: "2026-06-02T00:00:00.000Z",
    });

    const result = getDealsByStage([newest, oldest, middle], dealStages);

    expect(result.interested.map((d) => d.id)).toEqual([2, 3, 1]);
  });

  it("ignores the legacy `index` field entirely — stage_entered_at is the only ordering signal", () => {
    // Deliberately contradictory `index` values: if the old field still
    // drove ordering, this would sort [2, 1]; it must sort by
    // stage_entered_at instead, [1, 2].
    const first = buildDeal({
      id: 1,
      index: 5,
      stage_entered_at: "2026-06-01T00:00:00.000Z",
    });
    const second = buildDeal({
      id: 2,
      index: 0,
      stage_entered_at: "2026-06-02T00:00:00.000Z",
    });

    const result = getDealsByStage([second, first], dealStages);

    expect(result.interested.map((d) => d.id)).toEqual([1, 2]);
  });

  it("sorts each stage column independently", () => {
    const interestedOld = buildDeal({
      id: 1,
      stage: "interested",
      stage_entered_at: "2026-06-01T00:00:00.000Z",
    });
    const interestedNew = buildDeal({
      id: 2,
      stage: "interested",
      stage_entered_at: "2026-06-05T00:00:00.000Z",
    });
    // call_booked's own oldest/newest are the reverse of interested's ids,
    // so a bug that shared one global sort across columns would fail this.
    const callBookedNew = buildDeal({
      id: 3,
      stage: "call_booked",
      stage_entered_at: "2026-06-05T00:00:00.000Z",
    });
    const callBookedOld = buildDeal({
      id: 4,
      stage: "call_booked",
      stage_entered_at: "2026-06-01T00:00:00.000Z",
    });

    const result = getDealsByStage(
      [interestedNew, interestedOld, callBookedNew, callBookedOld],
      dealStages,
    );

    expect(result.interested.map((d) => d.id)).toEqual([1, 2]);
    expect(result.call_booked.map((d) => d.id)).toEqual([4, 3]);
  });

  it("applies the same rule regardless of Offer — a Living Example and a Growing Yourself Up deal sort by the same stage_entered_at rule", () => {
    const gyuOlder = buildDeal({
      id: 1,
      offer_id: 2,
      cohort_id: 5,
      stage_entered_at: "2026-06-01T00:00:00.000Z",
    });
    const leNewer = buildDeal({
      id: 2,
      offer_id: 1,
      stage_entered_at: "2026-06-02T00:00:00.000Z",
    });

    const result = getDealsByStage([leNewer, gyuOlder], dealStages);

    expect(result.interested.map((d) => d.id)).toEqual([1, 2]);
  });
});
