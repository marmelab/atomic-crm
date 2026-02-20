import { InfinitePaginationContext, useListContext } from "ra-core";
import { Fragment, useEffect, useMemo, useState } from "react";
import { Separator } from "@/components/ui/separator";

import { Note } from "./Note";
import { NoteCreate } from "./NoteCreate";
import { InfinitePagination } from "../misc/InfinitePagination";

export const NotesIterator = ({
  reference,
  showStatus,
}: {
  reference: "contacts" | "deals";
  showStatus?: boolean;
}) => {
  const { data, error, isPending, page, setPage, total } = useListContext();

  const [allPages, setAllPages] = useState<Record<number, any[]>>({});

  useEffect(() => {
    if (!data) {
      return;
    }
    setAllPages((prev) => ({ ...prev, [page]: data }));
  }, [page, setAllPages, data]);

  const allLoadedData = useMemo(() => {
    return Object.entries(allPages)
      .sort(([pageA], [pageB]) => Number(pageA) - Number(pageB))
      .flatMap(([, pageData]) => pageData);
  }, [allPages]);

  if (isPending || error) return null;
  return (
    <InfinitePaginationContext.Provider
      value={{
        fetchNextPage: async (): Promise<any> => {
          setPage(page + 1);
        },
        hasNextPage: allLoadedData.length < total,
        isFetchingNextPage: isPending,
        fetchPreviousPage: async (): Promise<any> => {
          setPage(page - 1);
        },
        hasPreviousPage: page > 1,
        isFetchingPreviousPage: false,
      }}
    >
      <div className="mt-4">
        <NoteCreate reference={reference} showStatus={showStatus} />
        {allLoadedData.length && (
          <div className="mt-4 space-y-4">
            {allLoadedData.map((note, index) => (
              <Fragment key={index}>
                <Note
                  note={note}
                  isLast={index === allLoadedData.length - 1}
                  key={index}
                  showStatus={showStatus}
                />
                {index < allLoadedData.length - 1 && <Separator />}
              </Fragment>
            ))}
          </div>
        )}
        <InfinitePagination />
      </div>
    </InfinitePaginationContext.Provider>
  );
};
