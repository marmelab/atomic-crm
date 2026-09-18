import type { DataProvider, Identifier } from "ra-core";

import type { Contact, Deal } from "../types";
import { ensureContactTag } from "../tags/ensureContactTag";
import { closeSalesDecisionTasks } from "./closeSalesTasks";
import { resolveDefaultTaskSalesId } from "../sales-calls/resolveDefaultTaskSalesId";
import { GHOSTED_TAG_NAME } from "./recordOpportunityDecision";
import {
  canRemoveFromPipeline,
  findExitReason,
  type PipelineExitReason,
} from "./pipelineExit";

const GHOSTED_TAG_COLOR = "#c9ccd2";

export type RemoveFromPipelineResult =
  | { status: "removed"; reason: PipelineExitReason }
  | { status: "not-found" }
  // Already out, or already Won. A second click, a stale tab, or two tabs
  // on the same drawer is a safe no-op — never a second write and never a
  // reopening.
  | { status: "already-resolved" }
  | { status: "note-required" };

// Ending a sales process, from any active stage.
//
// Nothing is deleted and nothing is archived: the Contact, the Deal, the
// calls, the notes and the history all stay exactly as they are. What
// changes is that this Opportunity stops being active work, and the CRM
// records which of the several meanings of "over" applies.
export const removeFromPipeline = async (
  dataProvider: DataProvider,
  {
    opportunityId,
    reason,
    note,
  }: {
    opportunityId: Identifier;
    reason: PipelineExitReason;
    note?: string | null;
  },
): Promise<RemoveFromPipelineResult> => {
  const definition = findExitReason(reason);
  const trimmedNote = note?.trim() || null;

  if (definition.requiresNote && !trimmedNote) {
    return { status: "note-required" };
  }

  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };
  if (!canRemoveFromPipeline(deal)) return { status: "already-resolved" };

  await dataProvider.update<Deal>("deals", {
    id: deal.id,
    data: {
      outcome: definition.outcome,
      exit_reason: definition.reason,
      exit_note: trimmedNote,
      // Only set when the reason actually carries that meaning — never
      // overwritten with null, so a decision recorded earlier survives.
      ...(definition.prospectDecision
        ? { prospect_decision: definition.prospectDecision }
        : {}),
      ...(definition.ownerDecision
        ? { owner_decision: definition.ownerDecision }
        : {}),
    },
    previousData: deal,
  });

  // The stage is deliberately left where it is. They really did reach
  // Decision, or Committed, or wherever they got to, and rewriting that to
  // mark an exit would falsify the history the board is built on.

  if (definition.appliesGhostedTag) {
    await ensureContactTag(
      dataProvider,
      deal.contact_id,
      GHOSTED_TAG_NAME,
      GHOSTED_TAG_COLOR,
    );
  }

  if (definition.setsContactDoNotEngage) {
    // A standing gate on future selling belongs to the person, not to one
    // Opportunity they happened to have.
    const { data: contact } = await dataProvider.getOne<Contact>("contacts", {
      id: deal.contact_id,
    });
    if (contact.sales_eligibility !== "do_not_engage") {
      await dataProvider.update<Contact>("contacts", {
        id: contact.id,
        data: { sales_eligibility: "do_not_engage" },
        previousData: contact,
      });
    }
  }

  // Human-readable history, in the place Leif already reads history. The
  // structured reason lives on the Deal; this is so the story is legible
  // months later without decoding an enum.
  const salesId = await resolveDefaultTaskSalesId(dataProvider);
  await dataProvider.create("deal_notes", {
    data: {
      deal_id: deal.id,
      text: trimmedNote
        ? `Removed from pipeline — ${definition.label}: ${trimmedNote}`
        : `Removed from pipeline — ${definition.label}`,
      date: new Date().toISOString(),
      ...(salesId != null ? { sales_id: salesId } : {}),
    },
  });

  // Anything that was waiting on this decision is answered by it.
  await closeSalesDecisionTasks(
    dataProvider,
    deal.contact_id,
    new Date().toISOString(),
  );

  return { status: "removed", reason: definition.reason };
};
