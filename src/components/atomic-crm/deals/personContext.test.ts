import { describe, expect, test } from "vitest";
import { derivePersonContextLabel } from "./personContext";

const offersById = new Map([
  ["1", { id: 1, name: "The Living Example" }],
  ["2", { id: 2, name: "Growing Yourself Up" }],
]);

describe("derivePersonContextLabel", () => {
  test("returns null for a contact with no deals", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [],
      offersById,
      enrollmentsByOpportunity: new Map(),
    });
    expect(label).toBeNull();
  });

  test("labels a completed Enrollment as a past client of that offer", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [
        {
          id: 10,
          contact_id: 1,
          offer_id: 2,
          outcome: null,
          archived_at: null,
        },
      ],
      offersById,
      enrollmentsByOpportunity: new Map([["10", { status: "completed" }]]),
    });
    expect(label).toBe("Past Growing Yourself Up client");
  });

  test("labels an active Enrollment as an active client of that offer", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [
        {
          id: 11,
          contact_id: 1,
          offer_id: 1,
          outcome: null,
          archived_at: null,
        },
      ],
      offersById,
      enrollmentsByOpportunity: new Map([["11", { status: "active" }]]),
    });
    expect(label).toBe("Active The Living Example client");
  });

  test("labels an open, unarchived Opportunity with no outcome as an active opportunity", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [
        {
          id: 12,
          contact_id: 1,
          offer_id: 2,
          outcome: null,
          archived_at: null,
        },
      ],
      offersById,
      enrollmentsByOpportunity: new Map(),
    });
    expect(label).toBe("Active Growing Yourself Up opportunity");
  });

  test("an active Enrollment takes priority over a past one", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [
        {
          id: 20,
          contact_id: 1,
          offer_id: 2,
          outcome: null,
          archived_at: null,
        },
        {
          id: 21,
          contact_id: 1,
          offer_id: 1,
          outcome: null,
          archived_at: null,
        },
      ],
      offersById,
      enrollmentsByOpportunity: new Map([
        ["20", { status: "completed" }],
        ["21", { status: "active" }],
      ]),
    });
    expect(label).toBe("Active The Living Example client");
  });

  test("ignores deals belonging to a different contact", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [
        {
          id: 30,
          contact_id: 2,
          offer_id: 1,
          outcome: null,
          archived_at: null,
        },
      ],
      offersById,
      enrollmentsByOpportunity: new Map([["30", { status: "active" }]]),
    });
    expect(label).toBeNull();
  });

  test("an archived opportunity with no enrollment is never labeled active", () => {
    const label = derivePersonContextLabel({
      contactId: 1,
      deals: [
        {
          id: 31,
          contact_id: 1,
          offer_id: 1,
          outcome: null,
          archived_at: "2026-01-01T00:00:00Z",
        },
      ],
      offersById,
      enrollmentsByOpportunity: new Map(),
    });
    expect(label).toBeNull();
  });
});
