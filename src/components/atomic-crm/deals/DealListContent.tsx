import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import { useDataProvider, useGetList, useListContext } from "ra-core";
import { useEffect, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal, SalesCall } from "../types";
import { DealColumn } from "./DealColumn";
import type { DealsByStage } from "./stages";
import { getDealsByStage } from "./stages";
import { applyDealStageDrop } from "./applyDealStageDrop";
import { PostSaleSetupContext } from "./postSaleSetupContext";
import { useOnboardingPipeline } from "./useOnboardingPipeline";

export const DealListContent = () => {
  const { dealStages, dealPipelineStatuses } = useConfigurationContext();
  // Won (and any other configured pipeline-exit status) never renders as an
  // active Kanban column — it's excluded from the list query itself (see
  // DealList's filter), this just keeps the column set consistent with it.
  const activeDealStages = dealStages.filter(
    (stage) => !dealPipelineStatuses.includes(stage.value),
  );
  const { data: unorderedDeals, isPending, refetch } = useListContext<Deal>();
  const dataProvider = useDataProvider();

  // Won Opportunities whose setup is not finished. They are excluded from
  // the board's own query (Won is a pipeline-exit status), so they are
  // fetched separately and placed in the Onboarding column — the sale is
  // done, the setup work is not.
  const onboarding = useOnboardingPipeline();

  // Call Booked is ordered by the next genuine booked call, so the board
  // needs the calls themselves. Only booked ones matter for ordering.
  const { data: salesCalls } = useGetList<SalesCall>("sales_calls", {
    filter: { status: "booked" },
    pagination: { page: 1, perPage: 500 },
    sort: { field: "scheduled_at", order: "ASC" },
  });

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(
    getDealsByStage([], activeDealStages),
  );

  useEffect(() => {
    if (unorderedDeals) {
      const newDealsByStage = getDealsByStage(
        unorderedDeals,
        activeDealStages,
        salesCalls,
      );
      // Onboarding holds both: anything still literally at that stage, and
      // every Won Opportunity with setup outstanding.
      newDealsByStage.onboarding = [
        ...(newDealsByStage.onboarding ?? []),
        ...onboarding.deals,
      ];
      if (!isEqual(newDealsByStage, dealsByStage)) {
        setDealsByStage(newDealsByStage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedDeals, salesCalls, onboarding.deals]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;
    if (!destination || destination.droppableId === source.droppableId) return;

    const sourceDeal = dealsByStage[source.droppableId]?.[source.index];
    if (!sourceDeal) return;

    // Move the card immediately, to the END of the destination column —
    // not the drop index — because the shared "deals" stage-change hook
    // always stamps stage_entered_at to "now" and the column sorts
    // oldest-first, so the bottom is exactly where the real data will put
    // it once the update round-trips. Placing it there now avoids a visual
    // snap after refetch.
    setDealsByStage(
      moveDealToStageLocal(
        sourceDeal,
        source.droppableId,
        destination.droppableId,
        dealsByStage,
      ),
    );

    // The durable half lives in applyDealStageDrop so it can be proven
    // without simulating a browser drag.
    applyDealStageDrop(dataProvider, { result, dealsByStage }).then(() => {
      refetch();
    });
  };

  return (
    <PostSaleSetupContext.Provider value={onboarding.setupByDeal}>
      <DragDropContext onDragEnd={onDragEnd}>
        <div className="flex gap-4 overflow-x-auto pb-2">
          {activeDealStages.map((stage) => (
            <DealColumn
              stage={stage.value}
              deals={dealsByStage[stage.value]}
              key={stage.value}
            />
          ))}
        </div>
      </DragDropContext>
    </PostSaleSetupContext.Provider>
  );
};

// Kanban queue-ordering slice: moves the dragged card into the destination
// column's local state, at the end — see the onDragEnd comment above for
// why the end, not the drop index. Immutability: builds new arrays rather
// than splicing the existing ones in place.
const moveDealToStageLocal = (
  sourceDeal: Deal,
  sourceStage: string,
  destinationStage: string,
  dealsByStage: DealsByStage,
): DealsByStage => {
  const sourceColumn = dealsByStage[sourceStage].filter(
    (deal) => deal.id !== sourceDeal.id,
  );
  const destinationColumn = [...dealsByStage[destinationStage], sourceDeal];
  return {
    ...dealsByStage,
    [sourceStage]: sourceColumn,
    [destinationStage]: destinationColumn,
  };
};
