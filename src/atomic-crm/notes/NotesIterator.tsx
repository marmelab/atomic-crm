import { useListContext } from "ra-core";
import * as React from "react";

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
  if (isPending || error) return null;
  return (
    <div className="mt-4">
      <NoteCreate reference={reference} showStatus={showStatus} />
      {data && (
        <div className="mt-4 space-y-4">
          {data.map((note, index) => (
            <React.Fragment key={index}>
              <Note
                note={note}
                isLast={index === data.length - 1}
                key={index}
                showStatus={showStatus}
              />
              {index < data.length - 1 && <Separator />}
            </React.Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
