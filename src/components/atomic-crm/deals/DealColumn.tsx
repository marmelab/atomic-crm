import { Droppable } from "@hello-pangea/dnd";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";

export const DealColumn = ({
  stage,
  deals,
}: {
  stage: string;
  deals: Deal[];
}) => {
  const { dealStages } = useConfigurationContext();
  return (
    <div className="flex-1 pb-8">
      <div className="flex flex-col items-center">
        <h3 className="text-base font-medium">
          {findDealLabel(dealStages, stage)}
          {/* Opportunity count alongside the stage name: funnel volume,
              which is what a pipeline column is actually measuring. The
              stage-total dollar figure that used to sit under it is gone
              for the same reason money left the cards — it turned an
              operational board into a forecast, and "$0.00" under an
              empty column was noise pretending to be information. */}
          <span className="text-muted-foreground font-normal">
            {" "}
            · {deals.length}
          </span>
        </h3>
      </div>
      <Droppable droppableId={stage}>
        {(droppableProvided, snapshot) => (
          <div
            ref={droppableProvided.innerRef}
            {...droppableProvided.droppableProps}
            className={`flex flex-col rounded-2xl mt-2 gap-2 ${
              snapshot.isDraggingOver ? "bg-muted" : ""
            }`}
          >
            {deals.map((deal, index) => (
              <DealCard key={deal.id} deal={deal} index={index} />
            ))}
            {droppableProvided.placeholder}
          </div>
        )}
      </Droppable>
    </div>
  );
};
