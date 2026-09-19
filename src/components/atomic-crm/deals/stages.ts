import type { ConfigurationContextValue } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import {
  comparatorForStage,
  nextBookedCallByOpportunity,
  type SalesCallForOrdering,
} from "./pipelineOrdering";

export type DealsByStage = Record<Deal["stage"], Deal[]>;

export const getDealsByStage = (
  unorderedDeals: Deal[],
  dealStages: ConfigurationContextValue["dealStages"],
  // Sales calls are what Call Booked is ordered by. Optional so every
  // existing caller keeps working; without them that column falls back to
  // "no booking known" for everyone and stays deterministic.
  salesCalls?: readonly SalesCallForOrdering[],
  now?: number,
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
  // Each column sorts by what that column is FOR — see
  // pipelineOrdering.ts for the rule per stage and why. One shared
  // "longest in stage first" rule used to apply everywhere, which put a
  // stale unresolved call above a call happening in two hours.
  const nextCallAt = nextBookedCallByOpportunity(salesCalls);
  dealStages.forEach((stage) => {
    dealsByStage[stage.value] = dealsByStage[stage.value].sort(
      comparatorForStage(stage.value, { nextCallAt, now }),
    );
  });

  return dealsByStage;
};
