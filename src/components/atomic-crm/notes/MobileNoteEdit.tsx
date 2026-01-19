import {
  EditBase,
  Form,
  RecordRepresentation,
  useCreatePath,
  useGetIdentity,
  useRecordFromLocation,
} from "ra-core";

import { NoteInputs } from "./NoteInputs";
import { DeleteButton, ReferenceField, SaveButton } from "@/components/admin";
import MobileHeader from "../layout/MobileHeader";
import { ListButton } from "../misc/ListButton";
import { MobileContent } from "../layout/MobileContent";
import { foreignKeyMapping } from "./foreignKeyMapping";

export const MobileNoteEdit = () => {
  const { identity } = useGetIdentity();
  const createPath = useCreatePath();
  const recordFromLocation = useRecordFromLocation() || {};
  const { reference, showStatus } = recordFromLocation;

  if (!identity || !reference) return null;

  return (
    <EditBase redirect={createPath({ resource: reference, type: "list" })}>
      <MobileHeader>
        <ListButton resource={reference} />
        <div className="flex flex-1">
          <ReferenceField
            source={foreignKeyMapping[reference as "contacts" | "deals"]}
            reference={reference}
            render={({ referenceRecord }) => (
              <h1 className="text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
                Edit Note
                {referenceRecord ? (
                  <>
                    {" for "}
                    <RecordRepresentation
                      record={referenceRecord}
                      resource={reference}
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
          <NoteInputs showStatus={showStatus} />
          <div className="flex flex-col gap-2 mt-6">
            <SaveButton />
            <DeleteButton
              redirect={createPath({ resource: reference, type: "list" })}
            />
          </div>
        </Form>
      </MobileContent>
    </EditBase>
  );
};
