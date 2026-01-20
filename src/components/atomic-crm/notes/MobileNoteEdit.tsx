import {
  EditBase,
  Form,
  RecordRepresentation,
  useCreatePath,
  useGetIdentity,
} from "ra-core";

import { NoteInputs } from "./NoteInputs";
import { DeleteButton, ReferenceField, SaveButton } from "@/components/admin";
import MobileHeader from "../layout/MobileHeader";
import { ListButton } from "../misc/ListButton";
import { MobileContent } from "../layout/MobileContent";

export const MobileNoteEdit = () => {
  const { identity } = useGetIdentity();
  const createPath = useCreatePath();

  if (!identity) return null;

  return (
    <EditBase redirect={createPath({ resource: "contacts", type: "list" })}>
      <MobileHeader>
        <ListButton resource="contacts" />
        <div className="flex flex-1">
          <ReferenceField
            source="contact_id"
            reference="contacts"
            render={({ referenceRecord }) => (
              <h1 className="text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
                Edit Note
                {referenceRecord ? (
                  <>
                    {" for "}
                    <RecordRepresentation
                      record={referenceRecord}
                      resource="contacts"
                    />
                  </>
                ) : null}
              </h1>
            )}
          />
        </div>
      </MobileHeader>
      <MobileContent>
        <Form className="mt-1">
          <NoteInputs showStatus />
          <div className="flex flex-col gap-2 mt-6">
            <SaveButton />
            <DeleteButton
              redirect={createPath({ resource: "contacts", type: "list" })}
            />
          </div>
        </Form>
      </MobileContent>
    </EditBase>
  );
};
