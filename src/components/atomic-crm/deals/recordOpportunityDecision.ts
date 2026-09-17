import type { DataProvider, Identifier } from "ra-core";

import type { Deal } from "../types";
import { ensureContactTag } from "../tags/ensureContactTag";

// What happens when somebody at Decision actually decides.
//
// The Dashboard could show who was deciding and the Kanban could show the
// column, but there was no way to record the answer except by editing
// fields by hand — so people sat at Decision indefinitely and the widget
// that was supposed to say "these need you" slowly stopped meaning
// anything. These are canonical state mutations, not notes.
export const GHOSTED_TAG_NAME = "Ghosted";
// Same palette the manual tag UI uses (tags/colors.ts).
const GHOSTED_TAG_COLOR = "#c9ccd2";

export type OpportunityDecision =
  // They said yes. Stage advances; this is NOT Won — Won is payment
  // authority, and nobody has paid because somebody said yes.
  | "committed"
  // They considered the offer and said no.
  | "declined"
  // They stopped replying. Commercially the same as declined, humanly not
  // the same at all, and the difference is what decides whether Leif ever
  // writes to them again.
  | "ghosted";

export type RecordOpportunityDecisionResult =
  | { status: "recorded"; decision: OpportunityDecision }
  | { status: "not-found" }
  // Already closed or archived: a second click, a stale tab, or two tabs
  // open on the same Dashboard card is a safe no-op, never a second write
  // and never a reopening.
  | { status: "already-resolved" };

const DECIDING_STAGE = "decision";

export const recordOpportunityDecision = async (
  dataProvider: DataProvider,
  {
    opportunityId,
    decision,
  }: { opportunityId: Identifier; decision: OpportunityDecision },
): Promise<RecordOpportunityDecisionResult> => {
  const { data: deal } = await dataProvider
    .getOne<Deal>("deals", { id: opportunityId })
    .catch(() => ({ data: null as Deal | null }));
  if (!deal) return { status: "not-found" };

  // Never re-decide something that has already left the pipeline.
  if (
    deal.archived_at != null ||
    deal.outcome != null ||
    deal.stage === "won"
  ) {
    return { status: "already-resolved" };
  }

  const now = new Date().toISOString();

  if (decision === "committed") {
    if (deal.stage === "committed") {
      return { status: "already-resolved" };
    }
    await dataProvider.update<Deal>("deals", {
      id: deal.id,
      data: {
        stage: "committed",
        stage_entered_at: now,
        prospect_decision: "yes",
      },
      previousData: deal,
    });
    return { status: "recorded", decision };
  }

  // Both exits leave the ACTIVE pipeline through outcome — the canonical
  // exit mechanism this app already uses everywhere (archived_at null AND
  // stage <> 'won' AND outcome null is what "active" means). The stage is
  // deliberately left where it is: they really did reach Decision, and
  // rewriting that to mark an exit would falsify the history.
  await dataProvider.update<Deal>("deals", {
    id: deal.id,
    data: {
      outcome: "lost",
      prospect_decision: decision === "ghosted" ? "ghosted" : "no",
    },
    previousData: deal,
  });

  if (decision === "ghosted") {
    // Durable, Contact-level, and survives this Opportunity — the next
    // time this person appears, Leif can see they have gone quiet before.
    // Declining does NOT get a tag: saying no is a normal, healthy answer
    // and is not a behavioural pattern worth carrying forward.
    await ensureContactTag(
      dataProvider,
      deal.contact_id,
      GHOSTED_TAG_NAME,
      GHOSTED_TAG_COLOR,
    );
  }

  return { status: "recorded", decision };
};

// The Dashboard's People Deciding list and the Kanban's Decision column
// answer the same question, so they share this predicate rather than each
// deciding for themselves what "deciding" means.
export const isAtDecision = (
  deal: Pick<Deal, "stage" | "outcome" | "archived_at">,
): boolean =>
  deal.archived_at == null &&
  deal.outcome == null &&
  deal.stage === DECIDING_STAGE;
