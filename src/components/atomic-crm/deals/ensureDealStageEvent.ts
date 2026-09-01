import type { DataProvider } from "ra-core";

import type { Deal, DealStageEvent } from "../types";

// Kanban queue-ordering slice: mirrors the Postgres AFTER trigger
// record_deal_stage_event() (supabase/schemas/02_functions.sql) — appends
// the permanent deal_stage_events row for a genuine stage change.
// FakeRest's afterCreate/afterUpdate hooks only receive (result,
// dataProvider), not the original params/previousData (unlike the
// beforeCreate/beforeUpdate hooks that set deals.stage_entered_at in the
// first place), so this can't diff old vs new stage directly the way the
// BEFORE trigger pair can. Instead it checks whether the latest
// deal_stage_events row for this Opportunity already matches
// {stage, entered_at} and only inserts when it doesn't — an idempotent
// "ensure" rather than an unconditional append, so calling this more than
// once for the same unchanged deal (e.g. a second, unrelated field save)
// never duplicates a row. Called from providers/fakerest/dataProvider.ts's
// "deals" resource hooks, right after beforeCreate/beforeUpdate has
// already set stage_entered_at for a genuine change.
export const ensureDealStageEvent = async (
  dataProvider: DataProvider,
  deal: Deal,
): Promise<void> => {
  const { data: recent } = await dataProvider.getList<DealStageEvent>(
    "deal_stage_events",
    {
      filter: { opportunity_id: deal.id },
      pagination: { page: 1, perPage: 1 },
      sort: { field: "entered_at", order: "DESC" },
    },
  );
  const latest = recent[0];
  if (
    latest &&
    latest.stage === deal.stage &&
    latest.entered_at === deal.stage_entered_at
  ) {
    return;
  }

  await dataProvider.create("deal_stage_events", {
    data: {
      opportunity_id: deal.id,
      stage: deal.stage,
      entered_at: deal.stage_entered_at,
    },
  });
};
