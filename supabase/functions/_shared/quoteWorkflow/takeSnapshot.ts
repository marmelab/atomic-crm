/**
 * takeSnapshot — immutable point-in-time audit record for a quote.
 *
 * Fas 6A scope:
 *  - Captures quote state + line items after critical mutations succeed.
 *  - Failures are ALWAYS non-blocking: logged as warnings, never propagated.
 *  - Callers must call this AFTER a successful DB write, never before.
 *
 * Excluded from quote_state (intentional):
 *  - write_token: editor credential — must never appear in an audit log
 *  - approval_token: same security rationale
 *  - html_content: too large for inline storage (80–150 KB per quote),
 *    deferred to Fas 6B. pdf_url reference is stored instead.
 *
 * Snapshot version:
 *  snapshot_version = 1 for all Fas 6A snapshots. Bump when quote_state
 *  shape changes materially so dashboards can branch on the version field.
 */

export type SnapshotTriggerEvent =
  | "content_edited"
  | "sent_for_signing"
  | "viewed"
  | "signed"
  | "declined"
  | "expired"
  | "approval_confirmed";

export type SnapshotInitiatorSource =
  | "crm_seller"
  | "public_editor"
  | "discord_approval"
  | "docuseal_webhook"
  | "system";

/**
 * Minimal supabase surface required by takeSnapshot. The narrow type keeps
 * test mocks simple and avoids pulling full supabase-js typings into edge
 * function test contexts — consistent with the pattern used by pipelineLogger
 * and saveQuoteContent.
 *
 * The eq() return type is an intersection so both usages type-check:
 *   - .eq(...).single()            → used for the quotes SELECT
 *   - await .eq(...).order(...)    → used for the line_items SELECT (array result)
 *
 * OrderableArrayResult is self-referential so .order() chains are type-safe:
 *   .eq(...).order("sort_order").order("id")
 */
type OrderableArrayResult = Promise<{
  data: Record<string, unknown>[] | null;
  error: unknown;
}> & {
  order(
    column: string,
    options?: { ascending?: boolean },
  ): OrderableArrayResult;
};

interface MinimalSupabaseClient {
  from(table: string): {
    select(columns: string): {
      eq(
        column: string,
        value: unknown,
      ): {
        single(): Promise<{
          data: Record<string, unknown> | null;
          error: unknown;
        }>;
      } & OrderableArrayResult;
    };
    insert(data: unknown): Promise<{ error: unknown }>;
  };
}

export interface TakeSnapshotInput {
  supabase: MinimalSupabaseClient;
  quoteId: number;
  triggerEvent: SnapshotTriggerEvent;
  /** Null for non-status-transition events (e.g. content_edited). */
  oldStatus?: string | null;
  /** Null for non-status-transition events. */
  newStatus?: string | null;
  initiatorSource: SnapshotInitiatorSource;
  /** Null for webhooks, automations, and system processes. */
  initiatorUserId?: string | null;
  /** Free-form context: pipeline step, docuseal submission id, etc. */
  metadata?: Record<string, unknown>;
}

/**
 * Injectable type used by helpers (saveQuoteContent, createSigningSubmission)
 * to accept a snapshot function without receiving the supabase client
 * directly. The supabase client is captured in a closure by the caller.
 *
 * Usage in an edge function:
 *   takeSnapshotFn: (opts) => takeSnapshot({ supabase, ...opts })
 *
 * Usage in tests:
 *   takeSnapshotFn: jest.fn() / vi.fn()  — or simply omit to disable
 */
export type TakeSnapshotFn = (
  opts: Omit<TakeSnapshotInput, "supabase">,
) => Promise<void>;

// Columns included in quote_state. Excludes write_token, approval_token,
// html_content — see module header.
const QUOTE_STATE_COLUMNS = [
  "id",
  "title",
  "company_id",
  "contact_id",
  "deal_id",
  "sales_id",
  "status",
  "quote_number",
  "template_type",
  "generated_text",
  "custom_text",
  "generated_sections",
  "accent_color",
  "reference_images",
  "total_amount",
  "subtotal",
  "vat_amount",
  "currency",
  "vat_rate",
  "discount_percent",
  "payment_terms",
  "delivery_terms",
  "customer_reference",
  "terms_and_conditions",
  "notes_internal",
  "valid_until",
  "pdf_url",
  "docuseal_submission_id",
  "docuseal_signing_url",
  "docuseal_document_url",
  "signed_at",
  "sent_at",
  "approved_at",
  "approved_by",
  "created_at",
  "updated_at",
].join(", ");

const LINE_ITEM_COLUMNS =
  "id, quote_id, description, quantity, unit_price, total, sort_order, vat_rate";

/**
 * Take an immutable snapshot of a quote's current state.
 *
 * Errors are caught and logged — this function never throws. The caller's
 * primary mutation has already succeeded before this is called, and a
 * snapshot failure must not roll back or obscure that outcome.
 */
export async function takeSnapshot(input: TakeSnapshotInput): Promise<void> {
  try {
    const [quoteResult, lineItemsResult] = await Promise.all([
      input.supabase
        .from("quotes")
        .select(QUOTE_STATE_COLUMNS)
        .eq("id", input.quoteId)
        .single(),
      input.supabase
        .from("quote_line_items")
        .select(LINE_ITEM_COLUMNS)
        .eq("quote_id", input.quoteId)
        .order("sort_order")
        .order("id"),
    ]);

    if (quoteResult.error || !quoteResult.data) {
      console.warn("takeSnapshot: could not load quote state (non-fatal)", {
        quoteId: input.quoteId,
        triggerEvent: input.triggerEvent,
        error: quoteResult.error,
      });
      return;
    }

    const { error: insertError } = await input.supabase
      .from("quote_snapshots")
      .insert({
        quote_id: input.quoteId,
        trigger_event: input.triggerEvent,
        old_status: input.oldStatus ?? null,
        new_status: input.newStatus ?? null,
        initiator_source: input.initiatorSource,
        initiator_user_id: input.initiatorUserId ?? null,
        quote_state: quoteResult.data,
        line_items: lineItemsResult.data ?? [],
        snapshot_version: 1,
        metadata: input.metadata ?? {},
      });

    if (insertError) {
      console.warn("takeSnapshot: insert failed (non-fatal)", {
        quoteId: input.quoteId,
        triggerEvent: input.triggerEvent,
        error: insertError,
      });
    }
  } catch (err) {
    console.warn("takeSnapshot: unexpected error (non-fatal)", {
      quoteId: input.quoteId,
      triggerEvent: input.triggerEvent,
      error: err,
    });
  }
}
