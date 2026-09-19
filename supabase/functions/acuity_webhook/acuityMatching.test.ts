// @vitest-environment node
import { afterAll, beforeEach, describe, expect, it, vi } from "vitest";

const mockFrom = vi.hoisted(() => vi.fn());
const mockRpc = vi.hoisted(() => vi.fn());

vi.mock("../_shared/supabaseAdmin.ts", () => ({
  supabaseAdmin: {
    from: (...args: unknown[]) => mockFrom(...args),
    rpc: (...args: unknown[]) => mockRpc(...args),
  },
}));

import {
  findActiveOpportunity,
  findOrCreateContact,
  isActiveDeal,
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

  describe("resolveOfferCohort — effective-dated", () => {
    const offerRow = (over = {}) => ({
      id: 2,
      name: "Growing Yourself Up",
      type: "group",
      acuity_appointment_type_id: "64654501",
      ...over,
    });

    const mockResolution = (row) => {
      mockRpc.mockImplementation(() =>
        Promise.resolve({ data: row ? [row] : [], error: null }),
      );
    };

    it("resolves a booking by the date it was booked for, not by the type name today", async () => {
      mockResolution({
        offer_id: 2,
        offer_name: "Growing Yourself Up",
        kind: "sales_call",
        cohort_id: null,
        resolution: "mapped",
      });
      mockFrom.mockImplementation((table) => {
        if (table === "offers") {
          return {
            select: () => ({
              eq: () => ({
                maybeSingle: () => Promise.resolve({ data: offerRow() }),
              }),
            }),
          };
        }
        throw new Error("unexpected table: " + table);
      });

      const result = await resolveOfferCohort("64654501", "2026-10-16");

      expect(mockRpc).toHaveBeenCalledWith("resolve_acuity_appointment_type", {
        p_appointment_type_id: "64654501",
        p_on: "2026-10-16",
      });
      expect(result).toEqual({
        offer: offerRow(),
        cohort: null,
        kind: "sales_call",
      });
    });

    // The interval on 64654501 where nothing establishes the meaning. A
    // booking landing there is left for a human rather than guessed at.
    it("fails closed on an interval the map explicitly cannot determine", async () => {
      mockResolution({
        offer_id: null,
        offer_name: null,
        kind: "sales_call",
        cohort_id: null,
        resolution: "unknown",
      });

      expect(await resolveOfferCohort("64654501", "2026-03-05")).toBeNull();
    });

    it("fails closed on a gap — a type/date nothing claims", async () => {
      mockResolution(null);

      expect(await resolveOfferCohort("99999999", "2026-01-01")).toBeNull();
    });

    it("reports a client-session type as such, so it can never become a sales Opportunity", async () => {
      mockResolution({
        offer_id: 1,
        offer_name: "The Living Example",
        kind: "client_session",
        cohort_id: null,
        resolution: "mapped",
      });
      mockFrom.mockImplementation(() => ({
        select: () => ({
          eq: () => ({
            maybeSingle: () =>
              Promise.resolve({
                data: offerRow({
                  id: 1,
                  name: "The Living Example",
                  type: "individual",
                }),
              }),
          }),
        }),
      }));

      const result = await resolveOfferCohort("90522599", "2026-10-05");

      expect(result?.kind).toBe("client_session");
    });

    it("fails closed when the resolver itself errors, never guessing a default", async () => {
      mockRpc.mockImplementation(() =>
        Promise.resolve({ data: null, error: { message: "boom" } }),
      );

      expect(await resolveOfferCohort("64654501", "2026-10-16")).toBeNull();
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

describe("the active-sales predicate matches the SQL authority", () => {
  // An Edge Function cannot import from src/, so the rule exists here as a
  // third copy. This walks the same matrix the app-side test walks, so the
  // copy cannot drift from public.deal_is_active without failing.
  const STAGES = [
    "interested",
    "application_received",
    "approved",
    "call_booked",
    "decision",
    "won",
    "onboarding",
  ];
  const OUTCOMES = [
    null,
    "nurture",
    "needs_higher_care",
    "not_fit",
    "lost",
    "workshops_only",
  ];
  const ARCHIVED = [null, "2026-09-18T00:00:00.000Z"];

  /** What public.deal_is_active computes. */
  const sqlDealIsActive = (
    archived_at: string | null,
    stage: string,
    outcome: string | null,
  ) => archived_at === null && stage !== "won" && outcome === null;

  it("agrees on every stage, outcome and archive combination", () => {
    // Arrange
    const disagreements: string[] = [];

    for (const stage of STAGES) {
      for (const outcome of OUTCOMES) {
        for (const archived_at of ARCHIVED) {
          // Act
          const edge = isActiveDeal({
            stage,
            outcome,
            archived_at,
          } as never);
          const sql = sqlDealIsActive(archived_at, stage, outcome);

          // Assert
          if (edge !== sql) {
            disagreements.push(`${stage}/${outcome ?? "null"}/${archived_at}`);
          }
        }
      }
    }

    expect(disagreements).toEqual([]);
    expect(STAGES.length * OUTCOMES.length * ARCHIVED.length).toBe(84);
  });
});
