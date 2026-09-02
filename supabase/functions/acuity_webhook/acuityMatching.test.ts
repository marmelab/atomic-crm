// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
  },
}));

import {
  findActiveOpportunity,
  findOrCreateContact,
  normalizeEmail,
  resolveOfferCohort,
} from "./acuityMatching";

describe("acuityMatching", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });
  afterAll(() => {
    vi.resetAllMocks();
  });

  describe("normalizeEmail", () => {
    it("trims and lowercases", () => {
      expect(normalizeEmail("  Ada.Lovelace@Example.com  ")).toBe(
        "ada.lovelace@example.com",
      );
    });
  });

  describe("resolveOfferCohort", () => {
    it("resolves an individual Offer via its stable appointment-type id, never a name match", async () => {
      const offer = {
        id: 1,
        type: "individual",
        acuity_appointment_type_id: "111",
      };
      mockFrom.mockImplementation((table: string) => {
        if (table === "offers") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [offer], error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await resolveOfferCohort("111");

      expect(result).toEqual({ offer, cohort: null });
    });

    it("resolves a group Cohort's Offer via the Cohort's own appointment-type id", async () => {
      const cohort = { id: 5, offer_id: 2, acuity_appointment_type_id: "222" };
      const offer = { id: 2, type: "group", acuity_appointment_type_id: null };
      mockFrom.mockImplementation((table: string) => {
        if (table === "offers") {
          return {
            select: () => ({
              eq: (field: string) => {
                if (field === "acuity_appointment_type_id") {
                  return {
                    limit: () => Promise.resolve({ data: [], error: null }),
                  };
                }
                // resolving the cohort's own offer by id
                return { maybeSingle: () => Promise.resolve({ data: offer }) };
              },
            }),
          };
        }
        if (table === "cohorts") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [cohort], error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await resolveOfferCohort("222");

      expect(result).toEqual({ offer, cohort });
    });

    it("returns null for an unmapped appointment type — never guessed", async () => {
      mockFrom.mockImplementation((table: string) => {
        if (table === "offers" || table === "cohorts") {
          return {
            select: () => ({
              eq: () => ({
                limit: () => Promise.resolve({ data: [], error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await resolveOfferCohort("999999");

      expect(result).toBeNull();
    });
  });

  describe("findOrCreateContact", () => {
    it("matches an existing Contact by normalized email without overwriting their data", async () => {
      const existing = {
        id: 10,
        first_name: "Ada",
        last_name: "Lovelace",
        email_jsonb: [{ email: "ada@example.com", type: "Home" }],
      };
      const updateEq = vi.fn().mockResolvedValue({ data: null, error: null });
      mockFrom.mockImplementation((table: string) => {
        if (table === "contacts") {
          return {
            select: () => Promise.resolve({ data: [existing], error: null }),
            update: () => ({ eq: updateEq }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await findOrCreateContact({
        firstName: "Someone Else",
        lastName: "Typed In Acuity",
        email: "  ADA@Example.com ",
      });

      expect(result).toEqual(existing);
      // Only last_seen touched — never first_name/last_name/email_jsonb.
      expect(updateEq).toHaveBeenCalledWith("id", 10);
    });

    it("creates a new Contact when no email matches, never a name-only fallback", async () => {
      const created = {
        id: 11,
        first_name: "Grace",
        last_name: "Hopper",
        email_jsonb: [{ email: "grace@example.com", type: "Other" }],
      };
      mockFrom.mockImplementation((table: string) => {
        if (table === "contacts") {
          return {
            select: () => Promise.resolve({ data: [], error: null }),
            insert: () => ({
              select: () => ({
                single: () => Promise.resolve({ data: created, error: null }),
              }),
            }),
          };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await findOrCreateContact({
        firstName: "Grace",
        lastName: "Hopper",
        email: "grace@example.com",
      });

      expect(result).toEqual(created);
    });
  });

  describe("findActiveOpportunity", () => {
    const buildDeal = (overrides: Record<string, unknown> = {}) => ({
      id: 1,
      contact_id: 10,
      offer_id: 1,
      cohort_id: null,
      stage: "approved",
      outcome: null,
      archived_at: null,
      ...overrides,
    });

    it("matches the single active Opportunity for the Contact/Offer", async () => {
      const deal = buildDeal();
      mockFrom.mockImplementation((table: string) => {
        if (table === "deals") {
          const builder = {
            eq: () => builder,
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: [deal], error: null }),
          };
          return { select: () => builder };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await findActiveOpportunity({
        contactId: 10,
        offerId: 1,
        cohortId: null,
      });

      expect(result).toEqual({ deal, ambiguous: false });
    });

    it("treats two active Opportunities as ambiguous, never guessing", async () => {
      const deals = [buildDeal({ id: 1 }), buildDeal({ id: 2 })];
      mockFrom.mockImplementation((table: string) => {
        if (table === "deals") {
          const builder = {
            eq: () => builder,
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: deals, error: null }),
          };
          return { select: () => builder };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await findActiveOpportunity({
        contactId: 10,
        offerId: 1,
        cohortId: null,
      });

      expect(result).toEqual({ deal: null, ambiguous: true });
    });

    it("excludes Won/exited/archived deals from matching", async () => {
      const deals = [
        buildDeal({ id: 1, stage: "won" }),
        buildDeal({ id: 2, outcome: "lost" }),
        buildDeal({ id: 3, archived_at: "2026-01-01T00:00:00.000Z" }),
      ];
      mockFrom.mockImplementation((table: string) => {
        if (table === "deals") {
          const builder = {
            eq: () => builder,
            then: (resolve: (v: unknown) => void) =>
              resolve({ data: deals, error: null }),
          };
          return { select: () => builder };
        }
        throw new Error(`unexpected table: ${table}`);
      });

      const result = await findActiveOpportunity({
        contactId: 10,
        offerId: 1,
        cohortId: null,
      });

      expect(result).toEqual({ deal: null, ambiguous: false });
    });
  });
});
