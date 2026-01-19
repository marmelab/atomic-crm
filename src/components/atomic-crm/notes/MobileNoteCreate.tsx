import {
  CreateBase,
  Form,
  RecordRepresentation,
  useCreatePath,
  useGetIdentity,
  useGetOne,
  useRecordFromLocation,
} from "ra-core";

import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { ListButton } from "../misc/ListButton";
import { NoteCreateButton } from "./NoteCreate";
import { NoteInputs } from "./NoteInputs";

export const MobileNoteCreate = () => {
  const { identity } = useGetIdentity();
  const createPath = useCreatePath();
  const recordFromLocation = useRecordFromLocation() || {};
  const { reference_id, reference, showStatus } = recordFromLocation;
  const selectReference = reference_id == null;

  const { data: referenceRecord } = useGetOne(
    reference,
    { id: reference_id! },
    { enabled: !!reference_id && !!reference },
  );

  if (!reference || !identity) return null;

  return (
    <CreateBase redirect={createPath({ resource: reference, type: "list" })}>
      <MobileHeader>
        <ListButton resource={reference} />
        <div className="flex flex-1">
          <h1 className="text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
            {!selectReference ? "Create Note for " : "Create Note"}
            {!selectReference && (
              <RecordRepresentation
                record={referenceRecord}
                resource={reference}
              />
            )}
          </h1>
        </div>
      </MobileHeader>
      <MobileContent>
        <Form>
          <div className="space-y-3">
            <NoteInputs
              showStatus={showStatus}
              selectReference={selectReference}
              reference={reference}
            />
            <NoteCreateButton reference={reference} record={referenceRecord} />
          </div>
        </Form>
      </MobileContent>
    </CreateBase>
  );
};
