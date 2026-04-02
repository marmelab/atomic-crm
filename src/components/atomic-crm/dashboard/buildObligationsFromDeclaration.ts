import type { FiscalDeadlineComponent } from "./fiscalModelTypes";
import type { FiscalDeclaration, FiscalObligationSource } from "./fiscalRealityTypes";
import { roundFiscalOutput } from "./roundFiscalOutput";

// ── Threshold constants (same as fiscalDeadlines.ts) ─────────────────────────

const MIN_SUBSTITUTE_TAX_ADVANCE = 51.65;
const DOUBLE_SUBSTITUTE_TAX_ADVANCE_THRESHOLD = 257.52;

// ── Types ─────────────────────────────────────────────────────────────────────

/**
 * Matches FiscalObligation but omits server-assigned fields.
 * The provider adds id, created_at, updated_at, user_id on save.
 */
export type ObligationDraft = {
  declaration_id: string | null;
  source: FiscalObligationSource;
  component: FiscalDeadlineComponent;
  competence_year: number;
  payment_year: number;
  due_date: string;
  amount: number;
  installment_number: number | null;
  installment_total: number | null;
  is_overridden: boolean;
  overridden_at: string | null;
  notes: string | null;
};

// ── Builder ───────────────────────────────────────────────────────────────────

/**
 * Generates non-rateized fiscal obligations from a FiscalDeclaration.
 *
 * Rule: obligations are created for payment year T+1 (where T = declaration.tax_year).
 * Zero-amount obligations are not generated.
 * All monetary outputs are rounded via roundFiscalOutput.
 */
export const buildObligationsFromDeclaration = (
  declaration: FiscalDeclaration,
): ObligationDraft[] => {
  const T = declaration.tax_year;
  const paymentYear = T + 1;
  const june30 = `${paymentYear}-06-30`;
  const november30 = `${paymentYear}-11-30`;

  const { id: declarationId } = declaration;
  const {
    total_substitute_tax: totalTax,
    total_inps: totalInps,
    prior_advances_substitute_tax: priorTaxAdvances,
    prior_advances_inps: priorInpsAdvances,
  } = declaration;

  const drafts: ObligationDraft[] = [];

  const makeDraft = (
    component: FiscalDeadlineComponent,
    amount: number,
    competenceYear: number,
    dueDate: string,
  ): ObligationDraft => ({
    declaration_id: declarationId,
    source: "auto_generated",
    component,
    competence_year: competenceYear,
    payment_year: paymentYear,
    due_date: dueDate,
    amount: roundFiscalOutput(amount),
    installment_number: null,
    installment_total: null,
    is_overridden: false,
    overridden_at: null,
    notes: null,
  });

  // ── Saldo (competence T) ──────────────────────────────────────────────────

  const impostaSaldo = Math.max(0, totalTax - priorTaxAdvances);
  if (impostaSaldo > 0) {
    drafts.push(makeDraft("imposta_saldo", impostaSaldo, T, june30));
  }

  const inpsSaldo = Math.max(0, totalInps - priorInpsAdvances);
  if (inpsSaldo > 0) {
    drafts.push(makeDraft("inps_saldo", inpsSaldo, T, june30));
  }

  // ── Substitute tax acconti (competence T+1) ───────────────────────────────

  if (totalTax > DOUBLE_SUBSTITUTE_TAX_ADVANCE_THRESHOLD) {
    // Double acconto: 50% June, 50% November
    const half = totalTax / 2;
    drafts.push(makeDraft("imposta_acconto_1", half, paymentYear, june30));
    drafts.push(makeDraft("imposta_acconto_2", half, paymentYear, november30));
  } else if (totalTax >= MIN_SUBSTITUTE_TAX_ADVANCE) {
    // Single acconto: 100% November
    drafts.push(
      makeDraft("imposta_acconto_unico", totalTax, paymentYear, november30),
    );
  }
  // else: no acconto (tax < MIN_SUBSTITUTE_TAX_ADVANCE)

  // ── INPS acconti (competence T+1) ─────────────────────────────────────────

  if (totalInps > 0) {
    const inpsAcconto = totalInps * 0.4;
    drafts.push(makeDraft("inps_acconto_1", inpsAcconto, paymentYear, june30));
    drafts.push(
      makeDraft("inps_acconto_2", inpsAcconto, paymentYear, november30),
    );
  }

  return drafts;
};
