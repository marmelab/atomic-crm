import { InfinitePaginationContext } from "ra-core";
import { Fragment } from "react";
import { Separator } from "@/components/ui/separator";

import { Note } from "./Note";
import { NoteCreate } from "./NoteCreate";
import { InfinitePagination } from "../misc/InfinitePagination";
import { useAddInfinitePagination } from "./useAddInfinitePagination";

export const NotesIterator = ({
  reference,
  showStatus,
  showType,
}: {
  reference: "contacts" | "deals";
  showStatus?: boolean;
  showType?: boolean;
}) => {
  const { infinitePaginationContextValue, isPending, error, data } =
    useAddInfinitePagination();

  if (isPending || error) return null;

  return (
    <InfinitePaginationContext.Provider value={infinitePaginationContextValue}>
      <div className="mt-4">
        <NoteCreate
          reference={reference}
          showStatus={showStatus}
          showType={showType}
        />
        {data.length && (
          <div className="mt-4 space-y-4">
            {data.map((note, index) => (
              <Fragment key={index}>
                <Note
                  note={note}
                  isLast={index === data.length - 1}
                  key={index}
                  showStatus={showStatus}
                  showType={showType}
                />
                {index < data.length - 1 && <Separator />}
              </Fragment>
            ))}
          </div>
        )}
        <InfinitePagination />
      </div>
    </InfinitePaginationContext.Provider>
  );
};
