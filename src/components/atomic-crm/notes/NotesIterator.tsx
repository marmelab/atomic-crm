import { useListContext } from "ra-core";
import { Fragment } from "react";
import { Separator } from "@/components/ui/separator";

import { Note } from "./Note";
import { NoteCreate } from "./NoteCreate";
import { useIsMobile } from "@/hooks/use-mobile";

export const NotesIterator = ({
  reference,
  showStatus,
}: {
  reference: "contacts" | "deals";
  showStatus?: boolean;
}) => {
  const isMobile = useIsMobile();
  const { data, error, isPending } = useListContext();
  if (isPending || error) return null;
  return (
    <div className="md:mt-4">
      {isMobile ? null : (
        <NoteCreate reference={reference} showStatus={showStatus} />
      )}
      {data && (
        <div className="md:mt-4 space-y-4">
          {data.map((note, index) => (
            <Fragment key={index}>
              <Note
                note={note}
                isLast={index === data.length - 1}
                key={index}
                showStatus={showStatus}
              />
              {index < data.length - 1 && <Separator />}
            </Fragment>
          ))}
        </div>
      )}
    </div>
  );
};
