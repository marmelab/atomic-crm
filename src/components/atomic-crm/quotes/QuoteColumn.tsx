import { memo, useMemo } from "react";
import { Droppable } from "@hello-pangea/dnd";
import { cn } from "@/lib/utils";

import type { Quote } from "../types";
import {
  quoteStatusLabels,
  quoteStatusStyles,
  defaultQuoteStatusStyle,
} from "./quotesTypes";
import { QuoteCard } from "./QuoteCard";

export const QuoteColumn = memo(
  ({ status, quotes }: { status: string; quotes: Quote[] }) => {
    const style = quoteStatusStyles[status] ?? defaultQuoteStatusStyle;

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
        <div
          className={cn(
            "flex flex-col items-center rounded-lg px-2 py-1.5",
            style.bg,
          )}
        >
          <div className="flex items-center gap-1.5">
            <span className={cn("h-2 w-2 rounded-full shrink-0", style.dot)} />
            <h3
              className={cn(
                "text-xs font-semibold text-center leading-tight",
                style.text,
              )}
            >
              {quoteStatusLabels[status] ?? status}
            </h3>
            {quotes.length > 0 && (
              <span
                className={cn(
                  "text-[10px] font-medium rounded-full px-1.5 py-0.5 leading-none",
                  style.text,
                  "opacity-70",
                )}
              >
                {quotes.length}
              </span>
            )}
          </div>
          <p className={cn("text-xs font-medium", style.text, "opacity-70")}>
            {totalAmount}
          </p>
        </div>
        <Droppable droppableId={status}>
          {(droppableProvided, snapshot) => (
            <div
              ref={droppableProvided.innerRef}
              {...droppableProvided.droppableProps}
              className={cn(
                "flex flex-col rounded-2xl mt-2 gap-2 min-h-15",
                snapshot.isDraggingOver ? "bg-muted/50" : "",
              )}
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
