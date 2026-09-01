import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import { useDataProvider, useListContext } from "ra-core";
import { useEffect, useState } from "react";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { DealColumn } from "./DealColumn";
import type { DealsByStage } from "./stages";
import { getDealsByStage } from "./stages";

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

  const [dealsByStage, setDealsByStage] = useState<DealsByStage>(
    getDealsByStage([], activeDealStages),
  );

  useEffect(() => {
    if (unorderedDeals) {
      const newDealsByStage = getDealsByStage(unorderedDeals, activeDealStages);
      if (!isEqual(newDealsByStage, dealsByStage)) {
        setDealsByStage(newDealsByStage);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedDeals]);

  if (isPending) return null;

  const onDragEnd: OnDragEndResponder = (result) => {
    const { destination, source } = result;

    if (!destination) {
      return;
    }

    const sourceStage = source.droppableId;
    const destinationStage = destination.droppableId;

    // Kanban queue-ordering slice: columns now sort by stage_entered_at
    // (getDealsByStage, ./stages.ts), not a manual drag position, so
    // reordering within the same column has nothing left to persist — the
    // card visually returns to its real, time-based place, same as before
    // the drag.
    if (destinationStage === sourceStage) {
      return;
    }

    const sourceDeal = dealsByStage[sourceStage][source.index]!;

    // Compute the local state change synchronously. The card is placed at
    // the END of the destination column here — not at the drop index —
    // because the shared "deals" stage-change hook below always stamps
    // stage_entered_at to "now", and the column sorts oldest-first, so the
    // bottom is exactly where the real data will place it once the update
    // round-trips. Placing it there immediately avoids a visual snap after
    // refetch.
    setDealsByStage(
      moveDealToStageLocal(
        sourceDeal,
        sourceStage,
        destinationStage,
        dealsByStage,
      ),
    );

    // Persist the stage change through the one shared path every other
    // stage-changing pathway (Application review, sales-call booking/
    // outcomes) already uses — the "deals" resource hook stamps
    // stage_entered_at and records the deal_stage_events history row, so
    // there is nothing else to do here.
    dataProvider
      .update("deals", {
        id: sourceDeal.id,
        data: { stage: destinationStage },
        previousData: sourceDeal,
      })
      .then(() => {
        refetch();
      });
  };

  return (
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
