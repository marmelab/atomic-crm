import { describe, expect, it } from "vitest";

import {
  deriveAgreedTerms,
  intervalsBetween,
  isRefusal,
  phaseInstallments,
  type SchedulePhaseFacts,
} from "./stripeAgreedTerms.ts";

// What a Stripe plan proves, and what it does not.
//
// Emma Wijns's Opportunity carried her Subscription Schedule and still
// read "Agreed terms not recorded", because linking a plan and knowing
// the agreed total were never connected. Her schedule says $1,000 a month
// from 1 November to 1 March — four payments, four thousand dollars — and
// none of that needed guessing.
//
// The refusals matter as much as the derivations. Every synthetic figure
// below; no real client's terms appear in this file.

const SEC = (iso: string) => Math.floor(Date.parse(iso) / 1000);

const phase = (over: Partial<SchedulePhaseFacts> = {}): SchedulePhaseFacts => ({
  amountMinor: 100000,
  interval: "month",
  intervalCount: 1,
  iterations: null,
  startDate: SEC("2026-11-01T00:00:00Z"),
  endDate: SEC("2027-03-01T00:00:00Z"),
  ...over,
});

describe("counting intervals between two instants", () => {
  it("counts whole months", () => {
    expect(
      intervalsBetween(
        SEC("2026-11-01T00:00:00Z"),
        SEC("2027-03-01T00:00:00Z"),
        "month",
      ),
    ).toBe(4);
  });

  it("counts whole years and weeks and days", () => {
    expect(
      intervalsBetween(
        SEC("2026-01-01T00:00:00Z"),
        SEC("2029-01-01T00:00:00Z"),
        "year",
      ),
    ).toBe(3);
    expect(
      intervalsBetween(
        SEC("2026-01-01T00:00:00Z"),
        SEC("2026-01-29T00:00:00Z"),
        "week",
      ),
    ).toBe(4);
    expect(
      intervalsBetween(
        SEC("2026-01-01T00:00:00Z"),
        SEC("2026-01-06T00:00:00Z"),
        "day",
      ),
    ).toBe(5);
  });

  it("refuses a span that is not a whole number of intervals", () => {
    // The 1st to the 15th is not "about two weeks" — it is a span this
    // cannot count, and a total built on a rounded count is wrong by an
    // installment.
    expect(
      intervalsBetween(
        SEC("2026-11-01T00:00:00Z"),
        SEC("2027-03-15T00:00:00Z"),
        "month",
      ),
    ).toBeNull();
    expect(
      intervalsBetween(
        SEC("2026-01-01T00:00:00Z"),
        SEC("2026-01-30T00:00:00Z"),
        "week",
      ),
    ).toBeNull();
  });

  it("refuses an interval it does not understand, and a backwards span", () => {
    expect(
      intervalsBetween(
        SEC("2026-11-01T00:00:00Z"),
        SEC("2027-03-01T00:00:00Z"),
        "fortnight",
      ),
    ).toBeNull();
    expect(
      intervalsBetween(
        SEC("2027-03-01T00:00:00Z"),
        SEC("2026-11-01T00:00:00Z"),
        "month",
      ),
    ).toBeNull();
  });
});

describe("how many payments one phase makes", () => {
  it("takes Stripe's own iteration count when it has one", () => {
    expect(phaseInstallments(phase({ iterations: 6 }))).toBe(6);
  });

  it("falls back to the span between start and end", () => {
    expect(phaseInstallments(phase())).toBe(4);
  });

  it("refuses an open-ended phase", () => {
    // A monthly subscription with no end proves a RATE. It never proves a
    // total, however long it has been running.
    expect(phaseInstallments(phase({ endDate: null }))).toBeNull();
  });

  it("refuses a multiplied interval rather than approximating it", () => {
    expect(phaseInstallments(phase({ intervalCount: 3 }))).toBeNull();
  });
});

describe("the agreed total a plan proves", () => {
  it("derives Emma's four thousand from four monthly payments", () => {
    // Arrange — the shape of her real schedule, synthetic amounts aside.
    const result = deriveAgreedTerms([phase()], 0);

    // Assert
    expect(isRefusal(result)).toBe(false);
    expect(result).toEqual({
      totalMinor: 400000,
      installmentCount: 4,
      installmentAmountMinor: 100000,
    });
  });

  it("does not round a total that is not round", () => {
    // Six payments of $666 is $3,996, not the $4,000 list price. The plan
    // is what was agreed; the list price is a fact about the product.
    const result = deriveAgreedTerms(
      [phase({ amountMinor: 66600, iterations: 6 })],
      0,
    );
    expect(result).toMatchObject({ totalMinor: 399600, installmentCount: 6 });
  });

  it("adds phases together and stops naming one installment size", () => {
    const result = deriveAgreedTerms(
      [
        phase({ amountMinor: 100000, iterations: 2 }),
        phase({ amountMinor: 50000, iterations: 4 }),
      ],
      0,
    );
    expect(result).toEqual({
      totalMinor: 400000,
      installmentCount: 6,
      installmentAmountMinor: null,
    });
  });

  it("refuses when money was collected outside the plan", () => {
    // Daniel Alexander: $500 taken, then six months arranged. $3,498 and
    // $3,998 are both defensible, so neither is written.
    const result = deriveAgreedTerms(
      [phase({ amountMinor: 58300, iterations: 6 })],
      50000,
    );
    expect(isRefusal(result)).toBe(true);
    expect(result).toMatchObject({
      reason: expect.stringContaining("outside this plan"),
    });
  });

  it("refuses an open-ended plan", () => {
    const result = deriveAgreedTerms([phase({ endDate: null })], 0);
    expect(isRefusal(result)).toBe(true);
    expect(result).toMatchObject({
      reason: expect.stringContaining("does not say when it ends"),
    });
  });

  it("refuses a phase whose price could not be read", () => {
    const result = deriveAgreedTerms([phase({ amountMinor: null })], 0);
    expect(isRefusal(result)).toBe(true);
    expect(result).toMatchObject({
      reason: expect.stringContaining("no readable amount"),
    });
  });

  it("refuses a plan with no phases at all", () => {
    expect(isRefusal(deriveAgreedTerms([], 0))).toBe(true);
  });
});
