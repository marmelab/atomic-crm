import { DragDropContext, type OnDragEndResponder } from "@hello-pangea/dnd";
import isEqual from "lodash/isEqual";
import { useDataProvider, useListContext, type DataProvider } from "ra-core";
import { useCallback, useEffect, useState } from "react";
import { useIsMobile } from "@/hooks/use-mobile";

import type { Quote } from "../types";
import { QuoteColumn } from "./QuoteColumn";
import { QuoteMobileList } from "./QuoteMobileList";
import { quoteStatuses } from "./quotesTypes";
import { getQuotesByStatus, type QuotesByStatus } from "./stages";

export const QuoteListContent = () => {
  const isMobile = useIsMobile();
  if (isMobile) return <QuoteMobileList />;
  return <QuoteKanbanBoard />;
};

const QuoteKanbanBoard = () => {
  const { data: unorderedQuotes, isPending, refetch } = useListContext<Quote>();
  const dataProvider = useDataProvider();

  const [quotesByStatus, setQuotesByStatus] = useState<QuotesByStatus>(
    getQuotesByStatus([], quoteStatuses),
  );

  useEffect(() => {
    if (unorderedQuotes) {
      const newQuotesByStatus = getQuotesByStatus(
        unorderedQuotes,
        quoteStatuses,
      );
      if (!isEqual(newQuotesByStatus, quotesByStatus)) {
        setQuotesByStatus(newQuotesByStatus);
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [unorderedQuotes]);

  const onDragEnd: OnDragEndResponder = useCallback(
    (result) => {
      const { destination, source } = result;

      if (!destination) return;

      // Block drag into "rifiutato" — must edit the quote to set rejection_reason
      if (
        destination.droppableId === "rifiutato" &&
        source.droppableId !== "rifiutato"
      ) {
        return;
      }

      if (
        destination.droppableId === source.droppableId &&
        destination.index === source.index
      ) {
        return;
      }

      const sourceStatus = source.droppableId;
      const destinationStatus = destination.droppableId;
      const sourceQuote = quotesByStatus[sourceStatus][source.index]!;
      const destinationQuote = quotesByStatus[destinationStatus][
        destination.index
      ] ?? {
        status: destinationStatus,
        index: undefined,
      };

      setQuotesByStatus(
        updateQuoteStatusLocal(
          sourceQuote,
          { status: sourceStatus, index: source.index },
          { status: destinationStatus, index: destination.index },
          quotesByStatus,
        ),
      );

      updateQuoteStatus(sourceQuote, destinationQuote, dataProvider).then(
        () => {
          refetch();
        },
      );
    },
    [quotesByStatus, dataProvider, refetch],
  );

  if (isPending) return null;

  return (
    <DragDropContext onDragEnd={onDragEnd}>
      <div className="flex gap-2 overflow-x-auto pb-4">
        {quoteStatuses.map((status) => (
          <QuoteColumn
            status={status.value}
            quotes={quotesByStatus[status.value]}
            key={status.value}
          />
        ))}
      </div>
    </DragDropContext>
  );
};

const updateQuoteStatusLocal = (
  sourceQuote: Quote,
  source: { status: string; index: number },
  destination: { status: string; index?: number },
  quotesByStatus: QuotesByStatus,
) => {
  if (source.status === destination.status) {
    const column = quotesByStatus[source.status];
    column.splice(source.index, 1);
    column.splice(destination.index ?? column.length + 1, 0, sourceQuote);
    return { ...quotesByStatus, [destination.status]: column };
  } else {
    const sourceColumn = quotesByStatus[source.status];
    const destinationColumn = quotesByStatus[destination.status];
    sourceColumn.splice(source.index, 1);
    destinationColumn.splice(
      destination.index ?? destinationColumn.length + 1,
      0,
      sourceQuote,
    );
    return {
      ...quotesByStatus,
      [source.status]: sourceColumn,
      [destination.status]: destinationColumn,
    };
  }
};

const updateQuoteStatus = async (
  source: Quote,
  destination: { status: string; index?: number },
  dataProvider: DataProvider,
) => {
  if (source.status === destination.status) {
    const { data: columnQuotes } = await dataProvider.getList("quotes", {
      sort: { field: "index", order: "ASC" },
      pagination: { page: 1, perPage: 100 },
      filter: { status: source.status },
    });
    const destinationIndex = destination.index ?? columnQuotes.length + 1;

    if (source.index > destinationIndex) {
      await Promise.all([
        ...columnQuotes
          .filter((q) => q.index >= destinationIndex && q.index < source.index)
          .map((q) =>
            dataProvider.update("quotes", {
              id: q.id,
              data: { index: q.index + 1 },
              previousData: q,
            }),
          ),
        dataProvider.update("quotes", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    } else {
      await Promise.all([
        ...columnQuotes
          .filter((q) => q.index <= destinationIndex && q.index > source.index)
          .map((q) =>
            dataProvider.update("quotes", {
              id: q.id,
              data: { index: q.index - 1 },
              previousData: q,
            }),
          ),
        dataProvider.update("quotes", {
          id: source.id,
          data: { index: destinationIndex },
          previousData: source,
        }),
      ]);
    }
  } else {
    const [{ data: sourceQuotes }, { data: destinationQuotes }] =
      await Promise.all([
        dataProvider.getList("quotes", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 100 },
          filter: { status: source.status },
        }),
        dataProvider.getList("quotes", {
          sort: { field: "index", order: "ASC" },
          pagination: { page: 1, perPage: 100 },
          filter: { status: destination.status },
        }),
      ]);
    const destinationIndex = destination.index ?? destinationQuotes.length + 1;

    await Promise.all([
      ...sourceQuotes
        .filter((q) => q.index > source.index)
        .map((q) =>
          dataProvider.update("quotes", {
            id: q.id,
            data: { index: q.index - 1 },
            previousData: q,
          }),
        ),
      ...destinationQuotes
        .filter((q) => q.index >= destinationIndex)
        .map((q) =>
          dataProvider.update("quotes", {
            id: q.id,
            data: { index: q.index + 1 },
            previousData: q,
          }),
        ),
      dataProvider.update("quotes", {
        id: source.id,
        data: {
          index: destinationIndex,
          status: destination.status,
        },
        previousData: source,
      }),
    ]);
  }
};
