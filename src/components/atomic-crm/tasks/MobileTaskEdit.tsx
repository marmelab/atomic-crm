import { EditBase, Form, RecordRepresentation } from "ra-core";
import MobileHeader from "../layout/MobileHeader";
import { MobileContent } from "../layout/MobileContent";
import { TaskFormContent } from "./TaskFormContent";
import { DeleteButton, ReferenceField, SaveButton } from "@/components/admin";
import { ListButton } from "../misc/ListButton";

export const MobileTaskEdit = () => (
  <EditBase>
    <MobileHeader>
      <ListButton />
      <div className="flex flex-1">
        <ReferenceField
          source="contact_id"
          reference="contacts"
          render={({ referenceRecord: contact }) => (
            <h1 className="text-xl font-semibold text-ellipsis overflow-hidden whitespace-nowrap">
              Edit Task
              {contact ? (
                <>
                  {" for "}
                  <RecordRepresentation record={contact} resource="contacts" />
                </>
              ) : null}
            </h1>
          )}
        />
      </div>
    </MobileHeader>
    <MobileContent>
      <Form>
        <TaskFormContent />
        <div className="flex flex-col gap-2 mt-6">
          <SaveButton />
          <DeleteButton />
        </div>
      </Form>
    </MobileContent>
  </EditBase>
);
