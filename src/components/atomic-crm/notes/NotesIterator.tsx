import { useListContext } from "ra-core";
import { Fragment } from "react";
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
  const { isPending, error, data = [] } = useListContext();

  if (isPending || error) return null;

  return (
    <div className="mt-4">
      <NoteCreate reference={reference} showStatus={showStatus} />
      {data.length > 0 && (
        <div className="mt-4 space-y-4">
          {data.map((note, index) => (
            <Fragment key={note.id}>
              <Note
                note={note}
                isLast={index === data.length - 1}
                showStatus={showStatus}
              />
              {index < data.length - 1 && <Separator />}
            </Fragment>
          ))}
        </div>
      )}
      <InfinitePagination />
    </div>
  );
};
