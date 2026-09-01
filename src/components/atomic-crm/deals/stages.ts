import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal } from "../types";

export type DealsByStage = Record<Deal["stage"], Deal[]>;

export const getDealsByStage = (
  unorderedDeals: Deal[],
  dealStages: ConfigurationContextValue["dealStages"],
) => {
  if (!dealStages) return {};
  const dealsByStage: Record<Deal["stage"], Deal[]> = unorderedDeals.reduce(
    (acc, deal) => {
      // if deal has a stage that does not exist in configuration, assign it to the first stage
      const stage = dealStages.find((s) => s.value === deal.stage)
        ? deal.stage
        : dealStages[0].value;
      acc[stage].push(deal);
      return acc;
    },
    dealStages.reduce(
      (obj, stage) => ({ ...obj, [stage.value]: [] }),
      {} as Record<Deal["stage"], Deal[]>,
    ),
  );
  // Kanban queue-ordering slice: each column sorts by how long an
  // Opportunity has been sitting in its CURRENT stage — oldest (longest
  // waiting) at the top, most-recently-entered at the bottom — using the
  // durable stage_entered_at set by every real stage-changing pathway
  // (see providers/fakerest/dataProvider.ts's "deals" hooks /
  // supabase/schemas/02_functions.sql's set_deal_stage_entered_at()).
  // Replaces the old manual drag-and-drop `index` field, which never
  // reflected genuine time-in-stage.
  dealStages.forEach((stage) => {
    dealsByStage[stage.value] = dealsByStage[stage.value].sort(
      (recordA: Deal, recordB: Deal) =>
        new Date(recordA.stage_entered_at).getTime() -
        new Date(recordB.stage_entered_at).getTime(),
    );
  });
  return dealsByStage;
};
