import { Droppable } from "@hello-pangea/dnd";

import { useConfigurationContext } from "../root/ConfigurationContext";
import type { Deal } from "../types";
import { findDealLabel } from "./dealUtils";
import { DealCard } from "./DealCard";
import { stageColorMap } from "./stageColors";

export const DealColumn = ({
  stage,
  deals,
}: {
  stage: string;
  deals: Deal[];
}) => {
  const totalAmount = deals.reduce((sum, deal) => sum + deal.amount, 0);
  const { dealStages, currency } = useConfigurationContext();
  const colors = stageColorMap[stage] ?? {
    border: "#E5E5E3",
    bg: "#F5F5F4",
    text: "#6B6B80",
  };

  return (
    <div className="flex-1 pb-8">
      <div
        className="flex flex-col items-center"
        style={{
          borderTop: `3px solid ${colors.border}`,
          backgroundColor: colors.bg,
          borderRadius: "8px 8px 0 0",
          padding: "8px",
        }}
      >
        <h3 className="text-base font-medium" style={{ color: colors.text }}>
          {findDealLabel(dealStages, stage)}
        </h3>
        <p className="text-sm text-muted-foreground">
          {totalAmount.toLocaleString("en-US", {
            notation: "compact",
            style: "currency",
            currency,
            currencyDisplay: "narrowSymbol",
            minimumSignificantDigits: 3,
          })}
        </p>
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
