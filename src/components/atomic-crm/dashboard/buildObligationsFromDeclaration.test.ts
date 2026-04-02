import { describe, expect, it } from "vitest";

import { buildObligationsFromDeclaration } from "./buildObligationsFromDeclaration";
import type { FiscalDeclaration } from "./fiscalRealityTypes";

// ── Fixture builder ───────────────────────────────────────────────────────────

const makeDeclaration = (
  overrides: Partial<FiscalDeclaration> = {},
): FiscalDeclaration => ({
  id: "decl-1",
  tax_year: 2024,
  total_substitute_tax: 500,
  total_inps: 300,
  prior_advances_substitute_tax: 0,
  prior_advances_inps: 0,
  notes: null,
  created_at: "2025-01-01T00:00:00.000Z",
  updated_at: "2025-01-01T00:00:00.000Z",
  user_id: "user-1",
  ...overrides,
});

// ── Tests ─────────────────────────────────────────────────────────────────────

describe("buildObligationsFromDeclaration", () => {
  describe("saldo generation", () => {
    it("generates imposta_saldo on June 30 of payment year (T+1)", () => {
      const decl = makeDeclaration({
        tax_year: 2024,
        total_substitute_tax: 500,
        prior_advances_substitute_tax: 200,
      });
      const obligations = buildObligationsFromDeclaration(decl);
      const saldo = obligations.find((o) => o.component === "imposta_saldo");

      expect(saldo).toBeDefined();
      expect(saldo!.due_date).toBe("2025-06-30");
      expect(saldo!.amount).toBe(300);
      expect(saldo!.competence_year).toBe(2024);
      expect(saldo!.payment_year).toBe(2025);
    });

    it("generates inps_saldo on June 30 of payment year (T+1)", () => {
      const decl = makeDeclaration({
        tax_year: 2024,
        total_inps: 300,
        prior_advances_inps: 100,
      });
      const obligations = buildObligationsFromDeclaration(decl);
      const saldo = obligations.find((o) => o.component === "inps_saldo");

      expect(saldo).toBeDefined();
      expect(saldo!.due_date).toBe("2025-06-30");
      expect(saldo!.amount).toBe(200);
      expect(saldo!.competence_year).toBe(2024);
      expect(saldo!.payment_year).toBe(2025);
    });
  });

  describe("double acconto — tax > €257.52", () => {
    it("generates imposta_acconto_1 (50%) on June 30 when tax > 257.52", () => {
      const decl = makeDeclaration({ total_substitute_tax: 400 });
      const obligations = buildObligationsFromDeclaration(decl);
      const acc1 = obligations.find((o) => o.component === "imposta_acconto_1");

      expect(acc1).toBeDefined();
      expect(acc1!.due_date).toBe("2025-06-30");
      expect(acc1!.amount).toBe(200);
      expect(acc1!.competence_year).toBe(2025);
    });

    it("generates imposta_acconto_2 (50%) on November 30 when tax > 257.52", () => {
      const decl = makeDeclaration({ total_substitute_tax: 400 });
      const obligations = buildObligationsFromDeclaration(decl);
      const acc2 = obligations.find((o) => o.component === "imposta_acconto_2");

      expect(acc2).toBeDefined();
      expect(acc2!.due_date).toBe("2025-11-30");
      expect(acc2!.amount).toBe(200);
      expect(acc2!.competence_year).toBe(2025);
    });

    it("does NOT generate imposta_acconto_unico when tax > 257.52", () => {
      const decl = makeDeclaration({ total_substitute_tax: 400 });
      const obligations = buildObligationsFromDeclaration(decl);
      const accUnico = obligations.find(
        (o) => o.component === "imposta_acconto_unico",
      );

      expect(accUnico).toBeUndefined();
    });

    it("treats exactly 257.53 as double acconto (> threshold)", () => {
      const decl = makeDeclaration({ total_substitute_tax: 257.53 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "imposta_acconto_1"),
      ).toBe(true);
      expect(
        obligations.some((o) => o.component === "imposta_acconto_2"),
      ).toBe(true);
    });
  });

  describe("single acconto — €51.65 <= tax <= €257.52", () => {
    it("generates imposta_acconto_unico (100%) on November 30 when 51.65 <= tax <= 257.52", () => {
      const decl = makeDeclaration({ total_substitute_tax: 100 });
      const obligations = buildObligationsFromDeclaration(decl);
      const accUnico = obligations.find(
        (o) => o.component === "imposta_acconto_unico",
      );

      expect(accUnico).toBeDefined();
      expect(accUnico!.due_date).toBe("2025-11-30");
      expect(accUnico!.amount).toBe(100);
      expect(accUnico!.competence_year).toBe(2025);
    });

    it("does NOT generate acconto_1 or acconto_2 when tax in single acconto range", () => {
      const decl = makeDeclaration({ total_substitute_tax: 100 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "imposta_acconto_1"),
      ).toBe(false);
      expect(
        obligations.some((o) => o.component === "imposta_acconto_2"),
      ).toBe(false);
    });

    it("treats exactly 51.65 as single acconto (lower boundary inclusive)", () => {
      const decl = makeDeclaration({ total_substitute_tax: 51.65 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "imposta_acconto_unico"),
      ).toBe(true);
    });

    it("treats exactly 257.52 as single acconto (upper boundary inclusive)", () => {
      const decl = makeDeclaration({ total_substitute_tax: 257.52 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "imposta_acconto_unico"),
      ).toBe(true);
      expect(
        obligations.some((o) => o.component === "imposta_acconto_1"),
      ).toBe(false);
    });
  });

  describe("no acconto — tax < €51.65", () => {
    it("generates no imposta acconto when tax < 51.65", () => {
      const decl = makeDeclaration({ total_substitute_tax: 40 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component.startsWith("imposta_acconto")),
      ).toBe(false);
    });

    it("treats exactly 51.64 as below threshold (no acconto)", () => {
      const decl = makeDeclaration({ total_substitute_tax: 51.64 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component.startsWith("imposta_acconto")),
      ).toBe(false);
    });
  });

  describe("INPS acconti — 40% each when INPS > 0", () => {
    it("generates inps_acconto_1 (40%) on June 30 when INPS > 0", () => {
      const decl = makeDeclaration({ total_inps: 500 });
      const obligations = buildObligationsFromDeclaration(decl);
      const acc1 = obligations.find((o) => o.component === "inps_acconto_1");

      expect(acc1).toBeDefined();
      expect(acc1!.due_date).toBe("2025-06-30");
      expect(acc1!.amount).toBe(200);
      expect(acc1!.competence_year).toBe(2025);
    });

    it("generates inps_acconto_2 (40%) on November 30 when INPS > 0", () => {
      const decl = makeDeclaration({ total_inps: 500 });
      const obligations = buildObligationsFromDeclaration(decl);
      const acc2 = obligations.find((o) => o.component === "inps_acconto_2");

      expect(acc2).toBeDefined();
      expect(acc2!.due_date).toBe("2025-11-30");
      expect(acc2!.amount).toBe(200);
      expect(acc2!.competence_year).toBe(2025);
    });

    it("generates no INPS acconti when INPS is 0", () => {
      const decl = makeDeclaration({ total_inps: 0 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component.startsWith("inps_acconto")),
      ).toBe(false);
    });
  });

  describe("zero-amount filtering", () => {
    it("does not generate zero-amount obligations", () => {
      const decl = makeDeclaration({
        total_substitute_tax: 0,
        total_inps: 0,
        prior_advances_substitute_tax: 0,
        prior_advances_inps: 0,
      });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(obligations).toHaveLength(0);
    });

    it("filters out imposta_saldo when it rounds to zero", () => {
      const decl = makeDeclaration({
        total_substitute_tax: 100,
        prior_advances_substitute_tax: 100,
        total_inps: 0,
      });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "imposta_saldo"),
      ).toBe(false);
    });
  });

  describe("saldo clamped to zero when advances exceed total", () => {
    it("clamps imposta_saldo to 0 when prior advances exceed total (zero-obligation not generated)", () => {
      const decl = makeDeclaration({
        total_substitute_tax: 300,
        prior_advances_substitute_tax: 400,
        total_inps: 0,
      });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "imposta_saldo"),
      ).toBe(false);
    });

    it("clamps inps_saldo to 0 when prior advances exceed total (zero-obligation not generated)", () => {
      const decl = makeDeclaration({
        total_substitute_tax: 0,
        total_inps: 200,
        prior_advances_inps: 250,
      });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(
        obligations.some((o) => o.component === "inps_saldo"),
      ).toBe(false);
    });
  });

  describe("source and declaration_id", () => {
    it("all obligations have source = 'auto_generated'", () => {
      const decl = makeDeclaration({ total_substitute_tax: 500, total_inps: 300 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(obligations.length).toBeGreaterThan(0);
      expect(obligations.every((o) => o.source === "auto_generated")).toBe(true);
    });

    it("all obligations carry the declaration_id", () => {
      const decl = makeDeclaration({ id: "decl-abc-123" });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(obligations.length).toBeGreaterThan(0);
      expect(obligations.every((o) => o.declaration_id === "decl-abc-123")).toBe(
        true,
      );
    });
  });

  describe("rounding", () => {
    it("rounds all monetary outputs via roundFiscalOutput", () => {
      // 257.53 / 2 = 128.765 → roundFiscalOutput yields 128.76 (IEEE 754 floor at .5)
      const decl = makeDeclaration({
        total_substitute_tax: 257.53,
        total_inps: 0,
        prior_advances_substitute_tax: 0,
      });
      const obligations = buildObligationsFromDeclaration(decl);
      const acc1 = obligations.find((o) => o.component === "imposta_acconto_1");

      expect(acc1).toBeDefined();
      // Verify amount is a rounded 2-decimal number (not raw floating point)
      expect(acc1!.amount).toBe(128.76);
      expect(Number.isInteger(acc1!.amount * 100)).toBe(true);
    });
  });

  describe("tax_year drives payment_year = T+1", () => {
    it("uses tax_year + 1 as payment_year for all generated obligations", () => {
      const decl = makeDeclaration({ tax_year: 2023, total_substitute_tax: 500 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(obligations.every((o) => o.payment_year === 2024)).toBe(true);
      expect(obligations.some((o) => o.due_date.startsWith("2024-"))).toBe(true);
    });
  });

  describe("non-rateized obligations only", () => {
    it("all obligations have installment_number = null", () => {
      const decl = makeDeclaration({ total_substitute_tax: 500, total_inps: 300 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(obligations.every((o) => o.installment_number === null)).toBe(true);
    });

    it("all obligations have installment_total = null", () => {
      const decl = makeDeclaration({ total_substitute_tax: 500, total_inps: 300 });
      const obligations = buildObligationsFromDeclaration(decl);

      expect(obligations.every((o) => o.installment_total === null)).toBe(true);
    });
  });
});
