/**
 * saveQuoteContent — single backend code path for mutating quotes.generated_sections.
 *
 * Phase 4 extraction. Before this helper existed, quote content could be
 * written from two different places:
 *   1. The CRM seller flow, which called `dataProvider.update("quotes", …)`
 *      with a raw `generated_sections` payload and bypassed every backend
 *      guard (no merge, no status check, no PDF regeneration).
 *   2. The public WYSIWYG editor, which called `save_quote_edits` and did
 *      its own ad-hoc deep-merge inline.
 *
 * That duplication was the classic cause of "I fixed a bug in one place
 * and a different editor surface broke." This helper collapses both paths
 * into one function with one merge semantics and one authoritative write.
 *
 * Callers today:
 *   - `save_quote_edits`  — public editor, authenticates via quotes.write_token
 *   - `save_quote_content` — CRM seller editor, authenticates via user JWT
 *
 * Callers must NOT bypass this helper. Frontend-facing code that wants
 * to mutate `generated_sections` must go through one of the two edge
 * functions above.
 */

import { QUOTE_STATUS } from "./constants.ts";
import type { TakeSnapshotFn } from "./takeSnapshot.ts";

/** Minimal supabase surface used by this helper — mirrors the pattern in
 *  createSigningSubmission.ts so test mocks stay simple and we do not
 *  pull the full supabase-js typings into edge-function test contexts. */
interface MinimalSupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        single(): Promise<{
          data: {
            id: number;
            generated_sections: unknown;
            status: string | null;
          } | null;
          error: unknown;
        }>;
      };
    };
    update(values: unknown): {
      eq(
        column: string,
        value: unknown,
      ): Promise<{ data: unknown; error: unknown }>;
    };
  };
}

export type SaveQuoteContentInitiator =
  /** Public WYSIWYG editor, authenticated via quotes.write_token. */
  | { source: "public_editor"; writeTokenVerified: true }
  /** CRM seller editor, authenticated via user JWT at the edge function level. */
  | { source: "crm_seller"; userId?: string | null };

export interface SaveQuoteContentInput {
  supabase: MinimalSupabaseClient;
  quoteId: number | string;
  sections: Record<string, unknown>;
  initiator: SaveQuoteContentInitiator;
  /**
   * Optional background function to regenerate the stored HTML after save.
   * Both current callers trigger generate_quote_pdf — this indirection lets
   * tests stub the regeneration without mocking fetch globally.
   */
  regeneratePdf?: (quoteId: number | string) => Promise<string | null>;
  /**
   * Fas 6A: optional snapshot function. When provided, a content_edited
   * snapshot is taken after a successful save — but ONLY when the merged
   * state differs from the existing state (no snapshot for no-op saves).
   * Inject as: (opts) => takeSnapshot({ supabase, ...opts })
   * Omit in tests to disable snapshot side-effects.
   */
  takeSnapshotFn?: TakeSnapshotFn;
}

export interface SaveQuoteContentResult {
  success: true;
  mergedSections: Record<string, unknown>;
  pdfUrl: string | null;
}

export class SaveQuoteContentError extends Error {
  constructor(
    readonly status: number,
    readonly code: string,
    message: string,
  ) {
    super(message);
    this.name = "SaveQuoteContentError";
  }
}

/**
 * Deep-merge two plain objects with the same rules both editors have
 * historically used:
 *
 *  - Plain objects (e.g. `upgrade_package`) are merged field-by-field so
 *    non-editable nested keys survive.
 *  - Arrays are REPLACED wholesale — callers must submit the entire
 *    array when they want to change it.
 *  - EXCEPTION: `reference_projects` is merged by index so the
 *    non-editable `url`/`link` fields on existing entries are preserved
 *    (the editor UI only captures visible text).
 *
 * Exported so the parity tests can cover it directly and future callers
 * have a single-source-of-truth for what "merge sections" means.
 */
export function deepMergeSections(
  target: Record<string, unknown>,
  source: Record<string, unknown>,
): Record<string, unknown> {
  const result: Record<string, unknown> = { ...target };
  for (const key of Object.keys(source)) {
    const tv = target[key];
    const sv = source[key];
    if (
      sv !== null &&
      typeof sv === "object" &&
      !Array.isArray(sv) &&
      tv !== null &&
      typeof tv === "object" &&
      !Array.isArray(tv)
    ) {
      result[key] = deepMergeSections(
        tv as Record<string, unknown>,
        sv as Record<string, unknown>,
      );
    } else if (
      key === "reference_projects" &&
      Array.isArray(sv) &&
      Array.isArray(tv)
    ) {
      result[key] = (sv as Record<string, unknown>[]).map((item, i) => {
        const existing = (tv as Record<string, unknown>[])[i] ?? {};
        return { ...existing, ...item };
      });
    } else {
      result[key] = sv;
    }
  }
  return result;
}

/**
 * Main entry point. Loads the quote, enforces the status guard, deep-merges
 * the incoming sections onto the stored ones, writes the result back, and
 * (optionally) triggers a PDF regeneration so the stored HTML artifact
 * stays in sync with the merged sections.
 *
 * Throws `SaveQuoteContentError` with HTTP-like status codes on failure so
 * calling edge functions can map directly to their response shape.
 */
export async function saveQuoteContent(
  input: SaveQuoteContentInput,
): Promise<SaveQuoteContentResult> {
  const {
    supabase,
    quoteId,
    sections,
    initiator,
    regeneratePdf,
    takeSnapshotFn,
  } = input;

  if (!quoteId) {
    throw new SaveQuoteContentError(
      400,
      "missing_quote_id",
      "Missing quote_id",
    );
  }
  if (!sections || typeof sections !== "object" || Array.isArray(sections)) {
    throw new SaveQuoteContentError(
      400,
      "invalid_sections",
      "sections must be a plain object",
    );
  }

  const { data: quote, error: loadError } = await supabase
    .from("quotes")
    .select("id, generated_sections, status")
    .eq("id", quoteId)
    .single();

  if (loadError || !quote) {
    throw new SaveQuoteContentError(404, "quote_not_found", "Quote not found");
  }

  // Status guard. Editing is only permitted while the quote is still in
  // the seller-controlled phase (draft, generated). Once a quote moves to
  // sent or viewed the customer either has the link in their inbox or has
  // already opened it — silently mutating the content from this point
  // would let the customer see a different version than what was approved
  // and create reproducibility holes that no audit trail can close.
  // Signed and declined are obviously locked. Sellers who need to change
  // a sent quote must explicitly recall it (move status back to generated)
  // before editing.
  const editableStatuses: readonly string[] = [
    QUOTE_STATUS.DRAFT,
    QUOTE_STATUS.GENERATED,
  ];
  if (!quote.status || !editableStatuses.includes(quote.status)) {
    throw new SaveQuoteContentError(
      409,
      "quote_locked",
      `Cannot edit a quote in status '${quote.status ?? "unknown"}' — recall to 'generated' first`,
    );
  }

  const existing =
    (quote.generated_sections as Record<string, unknown> | null) ?? {};
  const merged = deepMergeSections(existing, sections);

  const { error: updateError } = await supabase
    .from("quotes")
    .update({ generated_sections: merged })
    .eq("id", quote.id);

  if (updateError) {
    const msg =
      updateError instanceof Error ? updateError.message : "update failed";
    throw new SaveQuoteContentError(500, "update_failed", msg);
  }

  // PDF regeneration is best-effort — a failure here does not invalidate
  // the save that already landed in the DB. Both current callers follow
  // this convention, so it stays in the shared helper.
  let pdfUrl: string | null = null;
  if (regeneratePdf) {
    try {
      pdfUrl = await regeneratePdf(quote.id);
    } catch (regenError) {
      console.warn(
        "saveQuoteContent: PDF regeneration failed (non-fatal):",
        regenError,
      );
      pdfUrl = null;
    }
  }

  // Tiny audit signal so we can see at runtime which surface wrote each
  // edit when debugging. Matches the createSigningSubmission reuse log
  // pattern established in Phase 2.
  console.warn("saveQuoteContent: quote content updated", {
    quoteId: quote.id,
    initiatorSource: initiator.source,
    regenerated: pdfUrl != null,
  });

  // Fas 6A: snapshot only when the merged state actually changed.
  // JSON.stringify comparison is sufficient here — both objects originate
  // from the same code path (deepMergeSections over DB-loaded data), so
  // key order is stable. A false positive produces an extra snapshot;
  // a false negative silently skips one. We accept the former.
  if (takeSnapshotFn) {
    const stateChanged = JSON.stringify(merged) !== JSON.stringify(existing);
    if (stateChanged) {
      await takeSnapshotFn({
        quoteId: quote.id,
        triggerEvent: "content_edited",
        initiatorSource:
          initiator.source === "public_editor" ? "public_editor" : "crm_seller",
        initiatorUserId:
          initiator.source === "crm_seller" ? (initiator.userId ?? null) : null,
        metadata: { regenerated: pdfUrl != null },
      });
    }
  }

  return {
    success: true,
    mergedSections: merged,
    pdfUrl,
  };
}
