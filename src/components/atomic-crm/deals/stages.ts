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
      // A deal with a stage that is not configured cannot be placed on the
      // board. After the deal_pipeline_stages migration, legacy values are
      // remapped in the database and the settings page refuses to remove a
      // stage that is still used by deals, so this can only happen when a
      // custom stage list drops a stage externally. Such deals are grouped
      // under the first pipeline stage ("New") so they stay visible instead
      // of disappearing from the board.
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
  // order each column by index
  dealStages.forEach((stage) => {
    dealsByStage[stage.value] = dealsByStage[stage.value].sort(
      (recordA: Deal, recordB: Deal) => recordA.index - recordB.index,
    );
  });
  return dealsByStage;
};
