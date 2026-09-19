import type { Deal, OpportunityOutcome } from "../types";
import { isActiveOpportunity } from "./dealActivity";

// The one place that knows how a human reason becomes canonical state.
//
// Leif needs to end a sales process from anywhere in the pipeline, and
// until now the only ways out were Archive (which means "hide this", not
// "this ended") and dragging a card at a trash icon (which means nothing
// at all and covered several unrelated business outcomes at once).
//
// Every reason below maps onto an outcome that already exists, so this
// introduces no parallel status system: `outcome` still decides whether an
// Opportunity is in the active pipeline, and `exit_reason` records which
// of the several meanings of that outcome applies.
export type PipelineExitReason =
  | "nurture"
  | "timing"
  | "declined_offer"
  | "money"
  | "afraid"
  | "ghosted"
  | "not_fit"
  | "needs_higher_care"
  | "do_not_engage"
  | "other";

export type PipelineExitDefinition = {
  reason: PipelineExitReason;
  label: string;
  // What it does to the pipeline. Leif reads this, not the enum.
  help: string;
  outcome: OpportunityOutcome;
  prospectDecision?: Deal["prospect_decision"];
  ownerDecision?: Deal["owner_decision"];
  // Only Ghosted earns a durable behavioural tag. Declining is a normal,
  // healthy answer and is not a pattern worth carrying to the next
  // Opportunity.
  appliesGhostedTag?: boolean;
  // Do-not-engage is a standing gate on future selling, so it also sets
  // the Contact's own eligibility rather than living only on this Deal.
  setsContactDoNotEngage?: boolean;
  requiresNote?: boolean;
};

export const PIPELINE_EXIT_REASONS: readonly PipelineExitDefinition[] = [
  {
    reason: "nurture",
    label: "Nurture",
    help: "Not now, but the relationship stays real",
    outcome: "nurture",
  },
  {
    reason: "timing",
    label: "Timing",
    help: "They want this, just not yet",
    outcome: "nurture",
    prospectDecision: "no",
  },
  {
    reason: "declined_offer",
    label: "Declined the offer",
    help: "They considered it and said no",
    outcome: "lost",
    prospectDecision: "no",
  },
  {
    reason: "money",
    label: "Money",
    help: "They said no on price or affordability",
    outcome: "lost",
    prospectDecision: "no",
  },
  {
    reason: "afraid",
    label: "Afraid",
    help: "They pulled back rather than decided against it",
    outcome: "lost",
    prospectDecision: "no",
  },
  {
    reason: "ghosted",
    label: "Ghosted",
    help: "They stopped replying — adds a Ghosted tag",
    outcome: "lost",
    prospectDecision: "ghosted",
    appliesGhostedTag: true,
  },
  {
    reason: "not_fit",
    label: "Not a fit",
    help: "This is not the right work for them",
    outcome: "not_fit",
  },
  {
    reason: "needs_higher_care",
    label: "Needs higher care",
    help: "They need more support than this offer provides",
    outcome: "needs_higher_care",
  },
  {
    reason: "do_not_engage",
    label: "Do not engage",
    help: "Stop selling to this person — also set on their Contact",
    outcome: "lost",
    ownerDecision: "do_not_engage",
    setsContactDoNotEngage: true,
  },
  {
    reason: "other",
    label: "Other",
    help: "Say what happened in a sentence",
    outcome: "lost",
    requiresNote: true,
  },
];

/**
 * The reasons that actually mean "they said no".
 *
 * The Decision card's No button used to open the whole exit list, which
 * put Ghosted, Nurture and Not a fit inside a dialog titled "They said
 * no" — three things nobody said no to. Ghosted especially: staying
 * silent is not declining, and the difference decides whether Leif ever
 * writes to this person again.
 *
 * So No now offers only the negative answers a prospect can actually
 * give. The full list is still there under Remove from pipeline, which is
 * where an exit that is not a prospect's decision belongs.
 */
export const DECLINED_EXIT_REASONS: readonly PipelineExitReason[] = [
  "declined_offer",
  "money",
  "afraid",
  "timing",
];

/** Ghosted is its own answer, never one of No's reasons. */
export const GHOSTED_EXIT_REASON: PipelineExitReason = "ghosted";

export const findExitReason = (
  reason: PipelineExitReason,
): PipelineExitDefinition => {
  const found = PIPELINE_EXIT_REASONS.find((r) => r.reason === reason);
  if (!found) throw new Error(`unknown pipeline exit reason: ${reason}`);
  return found;
};

// An Opportunity can be removed from the pipeline whenever it is still in
// it. Deliberately not restricted to particular stages: a sales process
// can end at Approved, at Decision, at Committed, or anywhere else Leif
// legitimately decides it is over.
export const canRemoveFromPipeline = isActiveOpportunity;
