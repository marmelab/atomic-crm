import { memo, useMemo } from "react";
import { Droppable } from "@hello-pangea/dnd";

import type { Quote } from "../types";
import { quoteStatusLabels } from "./quotesTypes";
import { QuoteCard } from "./QuoteCard";

export const QuoteColumn = memo(
  ({ status, quotes }: { status: string; quotes: Quote[] }) => {
    const totalAmount = useMemo(
      () =>
        quotes
          .reduce((sum, q) => sum + q.amount, 0)
          .toLocaleString("it-IT", {
            notation: "compact",
            style: "currency",
            currency: "EUR",
            currencyDisplay: "narrowSymbol",
            minimumSignificantDigits: 3,
          }),
      [quotes],
    );

    return (
      <div className="min-w-[150px] flex-1 pb-8">
        <div className="flex flex-col items-center">
          <h3 className="text-xs font-medium text-center leading-tight">
            {quoteStatusLabels[status] ?? status}
          </h3>
          <p className="text-xs text-muted-foreground">{totalAmount}</p>
        </div>
        <Droppable droppableId={status}>
          {(droppableProvided, snapshot) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className={`flex flex-col rounded-2xl mt-2 gap-2 ${
                snapshot.isDraggingOver ? "bg-muted" : ""
              }`}
            >
              {quotes.map((quote, index) => (
                <QuoteCard key={quote.id} quote={quote} index={index} />
              ))}
              {droppableProvided.placeholder}
            </div>
          )}
        </Droppable>
      </div>
    );
  },
);
QuoteColumn.displayName = "QuoteColumn";
