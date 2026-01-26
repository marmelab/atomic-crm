import type { Identifier, RaRecord } from "ra-core";
import {
  EditBase,
  Form,
  RecordRepresentation,
  useCreatePath,
  useGetIdentity,
  WithRecord,
} from "ra-core";

import { DeleteButton, ReferenceField, SaveButton } from "@/components/admin";
import { MobileContent } from "../layout/MobileContent";
import MobileHeader from "../layout/MobileHeader";
import { MobileBackButton } from "../misc/MobileBackButton";
import { NoteInputs } from "./NoteInputs";

export const MobileNoteEdit = () => {
  const { identity } = useGetIdentity();
  const createPath = useCreatePath();
  const getRedirectTo = (record: Partial<RaRecord<Identifier>> | undefined) =>
    createPath({ resource: "contacts", type: "show", id: record?.contact_id });

  if (!identity) return null;

  return (
    <EditBase redirect={(_resource, _id, record) => getRedirectTo(record)}>
      <MobileHeader>
        <WithRecord
          render={(record) => <MobileBackButton to={getRedirectTo(record)} />}
        />
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
            <WithRecord
              render={(record) => (
                <DeleteButton redirect={getRedirectTo(record)} />
              )}
            />
          </div>
        </Form>
      </MobileContent>
    </EditBase>
  );
};
