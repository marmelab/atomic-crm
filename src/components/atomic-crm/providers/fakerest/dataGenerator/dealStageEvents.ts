import type { Db } from "./types";

// Kanban queue-ordering slice: seeds one deal_stage_events row per
// Opportunity, mirroring the deploy-time migration's own backfill for
// pre-existing rows — the only stage transition fixture/legacy data can
// honestly claim is "the current stage, entered at stage_entered_at"; no
// earlier-stage history exists for generated data, the same honest
// limitation real pre-migration rows have. Called once from index.ts,
// after every deal (random-generated and every named fixture) is
// finalized, so every deal's real (staggered) stage_entered_at is already
// set. Idempotent — skips a deal that already has a matching event — so
// it is safe even if a future generator pass runs it more than once.
export const backfillDealStageEvents = (db: Db) => {
  const nextId = () => db.deal_stage_events.length;
  for (const deal of db.deals) {
    const alreadyRecorded = db.deal_stage_events.some(
      (event) =>
        event.opportunity_id === deal.id &&
        event.stage === deal.stage &&
        event.entered_at === deal.stage_entered_at,
    );
    if (alreadyRecorded) continue;
    db.deal_stage_events.push({
      id: nextId(),
      opportunity_id: deal.id,
      stage: deal.stage,
      entered_at: deal.stage_entered_at,
      created_at: deal.stage_entered_at,
    });
  }
};
