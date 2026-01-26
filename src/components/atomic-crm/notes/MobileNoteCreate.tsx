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
import { MobileBackButton } from "../misc/MobileBackButton";
import { NoteCreateButton } from "./NoteCreate";
import { NoteInputs } from "./NoteInputs";

export const MobileNoteCreate = () => {
  const { identity } = useGetIdentity();
  const createPath = useCreatePath();
  const recordFromLocation = useRecordFromLocation();
  const contact_id = recordFromLocation?.contact_id;
  const selectContact = contact_id == null;

  const { data: contact } = useGetOne(
    "contacts",
    { id: contact_id! },
    { enabled: !!contact_id },
  );

  if (!identity) return null;

  return (
    <CreateBase redirect={createPath({ resource: "contacts", type: "list" })}>
      <MobileHeader>
        <MobileBackButton resource="contacts" />
        <div className="flex flex-1">
          <h1 className="text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
            {!selectContact ? "Create Note for " : "Create Note"}
            {!selectContact && (
              <RecordRepresentation record={contact} resource="contacts" />
            )}
          </h1>
        </div>
      </MobileHeader>
      <MobileContent>
        <Form>
          <div className="space-y-3">
            <NoteInputs
              showStatus
              reference="contacts"
              selectReference={selectContact}
            />
            <NoteCreateButton reference="contacts" record={contact} />
          </div>
        </Form>
      </MobileContent>
    </CreateBase>
  );
};
