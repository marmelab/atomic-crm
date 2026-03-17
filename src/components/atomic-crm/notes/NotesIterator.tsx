import { useListContext } from "ra-core";
import { Fragment, useMemo } from "react";
import { Separator } from "@/components/ui/separator";

import { Note } from "./Note";
import { NoteCreate } from "./NoteCreate";

export const NotesIterator = ({
  reference,
  showStatus,
}: {
  reference: "contacts" | "deals";
  showStatus?: boolean;
}) => {
  const { data, error, isPending } = useListContext();

  // Always show most recent note first
  const sortedData = useMemo(
    () =>
      data
        ? [...data].sort(
            (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime(),
          )
        : [],
    [data],
  );

  if (isPending || error) return null;
  return (
    <div className="mt-4">
      <NoteCreate reference={reference} showStatus={showStatus} />
      {sortedData.length > 0 && (
        <div className="mt-4 space-y-4">
          {sortedData.map((note, index) => (
            <Fragment key={note.id ?? index}>
              <Note
                note={note}
                isLast={index === sortedData.length - 1}
                showStatus={showStatus}
              />
              {index < sortedData.length - 1 && <Separator />}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
