import type { FiscalDeclaration, FiscalObligation, FiscalF24PaymentLineEnriched } from "../../dashboard/fiscalRealityTypes";
import type { ObligationDraft } from "../../dashboard/buildObligationsFromDeclaration";
import { buildObligationsFromDeclaration } from "../../dashboard/buildObligationsFromDeclaration";
import { supabase } from "./supabase";

// ── Types ────────────────────────────────────────────────────────────────────

export type BlockedObligation = {
  id: string;
  reason: "paid" | "overridden";
};

type RegenerateResult = {
  regeneratedCount: number;
  blockedObligations: BlockedObligation[];
};

type DeleteDeclarationResult = {
  deleted: boolean;
  blockedObligations: BlockedObligation[];
};

type RegisterF24Input = {
  submissionDate: string;
  notes: string | null;
  lines: Array<{ obligation_id: string; amount: number }>;
};

// ── Helpers ──────────────────────────────────────────────────────────────────

const throwOnError = <T>(
  result: { data: T; error: { message: string } | null },
  context: string,
): T => {
  if (result.error) {
    throw new Error(`${context}: ${result.error.message}`);
  }
  return result.data;
};

/**
 * Classify obligations into safe-to-delete and blocked.
 * An obligation is blocked if it is overridden or has payment lines.
 */
const classifyObligations = async (
  obligations: FiscalObligation[],
): Promise<{
  safeIds: string[];
  blocked: BlockedObligation[];
}> => {
  const allIds = obligations.map((o) => o.id);
  if (allIds.length === 0) return { safeIds: [], blocked: [] };

  // Check which obligations have payment lines
  const { data: paidLines } = await supabase
    .from("fiscal_f24_payment_lines")
    .select("obligation_id")
    .in("obligation_id", allIds);

  const paidObligationIds = new Set(
    (paidLines ?? []).map((l: { obligation_id: string }) => l.obligation_id),
  );

  const safeIds: string[] = [];
  const blocked: BlockedObligation[] = [];

  for (const ob of obligations) {
    if (ob.is_overridden) {
      blocked.push({ id: ob.id, reason: "overridden" });
    } else if (paidObligationIds.has(ob.id)) {
      blocked.push({ id: ob.id, reason: "paid" });
    } else if (ob.source === "auto_generated") {
      safeIds.push(ob.id);
    }
    // manual + not overridden + not paid → safe to delete on regeneration
    // but NOT safe for declaration delete (manual obligations stay)
  }

  return { safeIds, blocked };
};

// ── Builder ──────────────────────────────────────────────────────────────────

export const buildFiscalRealityProviderMethods = () => ({
  // ── Declarations ─────────────────────────────────────────────────────────

  async getFiscalDeclaration(
    taxYear: number,
  ): Promise<FiscalDeclaration | null> {
    const result = await supabase
      .from("fiscal_declarations")
      .select("*")
      .eq("tax_year", taxYear)
      .maybeSingle();

    if (result.error) {
      throw new Error(
        `getFiscalDeclaration: ${result.error.message}`,
      );
    }
    return result.data as FiscalDeclaration | null;
  },

  async saveFiscalDeclaration(
    declaration: Omit<
      FiscalDeclaration,
      "id" | "created_at" | "updated_at" | "user_id"
    > & { id?: string },
  ): Promise<FiscalDeclaration> {
    if (declaration.id) {
      // Update existing
      const { id, ...updates } = declaration;
      const data = throwOnError(
        await supabase
          .from("fiscal_declarations")
          .update(updates)
          .eq("id", id)
          .select()
          .single(),
        "saveFiscalDeclaration (update)",
      );
      return data as FiscalDeclaration;
    }

    // Create new
    const data = throwOnError(
      await supabase
        .from("fiscal_declarations")
        .insert(declaration)
        .select()
        .single(),
      "saveFiscalDeclaration (create)",
    );
    return data as FiscalDeclaration;
  },

  // ── Obligations ──────────────────────────────────────────────────────────

  async getFiscalObligations(
    paymentYear: number,
  ): Promise<FiscalObligation[]> {
    const data = throwOnError(
      await supabase
        .from("fiscal_obligations")
        .select("*")
        .eq("payment_year", paymentYear)
        .order("due_date", { ascending: true }),
      "getFiscalObligations",
    );
    return (data ?? []) as FiscalObligation[];
  },

  async createFiscalObligation(
    draft: ObligationDraft,
  ): Promise<FiscalObligation> {
    const data = throwOnError(
      await supabase
        .from("fiscal_obligations")
        .insert(draft)
        .select()
        .single(),
      "createFiscalObligation",
    );
    return data as FiscalObligation;
  },

  async updateFiscalObligation(
    id: string,
    updates: Partial<
      Omit<FiscalObligation, "id" | "created_at" | "updated_at" | "user_id">
    >,
  ): Promise<FiscalObligation> {
    // Fetch current to check if auto_generated → set overridden
    const { data: current } = await supabase
      .from("fiscal_obligations")
      .select("source")
      .eq("id", id)
      .single();

    const overrideFields =
      current?.source === "auto_generated" && !updates.is_overridden
        ? { is_overridden: true, overridden_at: new Date().toISOString() }
        : {};

    const data = throwOnError(
      await supabase
        .from("fiscal_obligations")
        .update({ ...updates, ...overrideFields })
        .eq("id", id)
        .select()
        .single(),
      "updateFiscalObligation",
    );
    return data as FiscalObligation;
  },

  // ── F24 Submissions ──────────────────────────────────────────────────────

  async registerF24(input: RegisterF24Input): Promise<{
    submission: { id: string; submission_date: string };
    linesCreated: number;
  }> {
    // Create submission
    const submission = throwOnError(
      await supabase
        .from("fiscal_f24_submissions")
        .insert({
          submission_date: input.submissionDate,
          notes: input.notes,
        })
        .select("id, submission_date")
        .single(),
      "registerF24 (submission)",
    );

    // Create payment lines
    const lines = input.lines.map((l) => ({
      submission_id: submission.id,
      obligation_id: l.obligation_id,
      amount: l.amount,
    }));

    throwOnError(
      await supabase.from("fiscal_f24_payment_lines").insert(lines),
      "registerF24 (payment lines)",
    );

    return {
      submission: submission as { id: string; submission_date: string },
      linesCreated: lines.length,
    };
  },

  async getEnrichedPaymentLinesForYear(
    paymentYear: number,
  ): Promise<FiscalF24PaymentLineEnriched[]> {
    // Step 1: Get obligation IDs for the payment year (DB-side filter)
    const obligations = throwOnError(
      await supabase
        .from("fiscal_obligations")
        .select("id")
        .eq("payment_year", paymentYear),
      "getEnrichedPaymentLinesForYear (obligations)",
    );

    const obligationIds = (obligations ?? []).map(
      (o: { id: string }) => o.id,
    );
    if (obligationIds.length === 0) return [];

    // Step 2: Get enriched payment lines for those obligation IDs
    const data = throwOnError(
      await supabase
        .from("fiscal_f24_payment_lines_enriched")
        .select("*")
        .in("obligation_id", obligationIds),
      "getEnrichedPaymentLinesForYear (lines)",
    );

    return (data ?? []) as FiscalF24PaymentLineEnriched[];
  },

  async deleteF24Submission(submissionId: string): Promise<void> {
    // Payment lines cascade-delete via FK
    throwOnError(
      await supabase
        .from("fiscal_f24_submissions")
        .delete()
        .eq("id", submissionId),
      "deleteF24Submission",
    );
  },

  // ── Regeneration & Declaration Delete ────────────────────────────────────

  async regenerateDeclarationObligations(
    declarationId: string,
  ): Promise<RegenerateResult> {
    // Load declaration
    const declaration = throwOnError(
      await supabase
        .from("fiscal_declarations")
        .select("*")
        .eq("id", declarationId)
        .single(),
      "regenerateDeclarationObligations (load declaration)",
    ) as FiscalDeclaration;

    // Load existing obligations for this declaration
    const existing = throwOnError(
      await supabase
        .from("fiscal_obligations")
        .select("*")
        .eq("declaration_id", declarationId),
      "regenerateDeclarationObligations (load obligations)",
    ) as FiscalObligation[];

    // Classify: safe to delete vs blocked
    const { safeIds, blocked } = await classifyObligations(existing);

    // Delete safe obligations
    if (safeIds.length > 0) {
      throwOnError(
        await supabase
          .from("fiscal_obligations")
          .delete()
          .in("id", safeIds),
        "regenerateDeclarationObligations (delete safe)",
      );
    }

    // Generate new drafts from declaration
    const drafts = buildObligationsFromDeclaration(declaration);

    // Insert new obligations
    if (drafts.length > 0) {
      throwOnError(
        await supabase.from("fiscal_obligations").insert(drafts),
        "regenerateDeclarationObligations (insert new)",
      );
    }

    return {
      regeneratedCount: drafts.length,
      blockedObligations: blocked,
    };
  },

  async deleteFiscalDeclaration(
    declarationId: string,
  ): Promise<DeleteDeclarationResult> {
    // Load obligations for this declaration
    const obligations = throwOnError(
      await supabase
        .from("fiscal_obligations")
        .select("*")
        .eq("declaration_id", declarationId),
      "deleteFiscalDeclaration (load obligations)",
    ) as FiscalObligation[];

    // Classify
    const { safeIds, blocked } = await classifyObligations(obligations);

    // Also consider manual obligations without payment lines as non-deletable
    // for declaration delete (they don't block but they stay orphaned)
    // Actually per spec: delete safe ones (auto_generated, not overridden, no payment lines)
    // If blocked remain, return deleted: false

    if (blocked.length > 0) {
      // Delete what we can, but report blocked
      if (safeIds.length > 0) {
        throwOnError(
          await supabase
            .from("fiscal_obligations")
            .delete()
            .in("id", safeIds),
          "deleteFiscalDeclaration (delete safe obligations)",
        );
      }
      return { deleted: false, blockedObligations: blocked };
    }

    // All clear — delete obligations then declaration
    if (safeIds.length > 0) {
      throwOnError(
        await supabase
          .from("fiscal_obligations")
          .delete()
          .in("id", safeIds),
        "deleteFiscalDeclaration (delete all obligations)",
      );
    }

    throwOnError(
      await supabase
        .from("fiscal_declarations")
        .delete()
        .eq("id", declarationId),
      "deleteFiscalDeclaration (delete declaration)",
    );

    return { deleted: true, blockedObligations: [] };
  },
});
